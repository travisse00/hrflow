import { randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import type { SendMessageInput, StartConversationInput } from "@/lib/validation/messaging";
import { claimableAttachmentIds } from "./attachments";
import { conversationVisibilityFilter, getHeadedDepartmentIds } from "./visibility";

/**
 * One reusable architecture for all four kinds of communication:
 *
 *   Conversation ── Participants (an EMPLOYEE or a DEPARTMENT each)
 *               └── Messages ── Attachments
 *
 *   Employee -> Employee    PRIVATE         participants: [employee, employee]
 *   Employee -> Department  ORGANIZATIONAL  participants: [employee, department]
 *   Department -> Dept      ORGANIZATIONAL  participants: [department, department]
 *   Department -> Employee  ORGANIZATIONAL  participants: [department, employee]
 *
 * A message always records the real person who wrote it (senderId). When a department head
 * speaks for their department, senderDepartmentId is also set ("Jane, on behalf of HR").
 */

const participantInclude = {
  employee: { select: { id: true, fullName: true } },
  department: { select: { id: true, name: true, path: true } },
} satisfies Prisma.ConversationParticipantInclude;

type ParticipantRow = Prisma.ConversationParticipantGetPayload<{ include: typeof participantInclude }>;

const participantLabel = (p: ParticipantRow): string =>
  p.type === "EMPLOYEE" ? (p.employee?.fullName ?? "Former employee") : (p.department?.name ?? "Unknown department");

function titleFor(conv: { kind: string; subject: string | null; participants: ParticipantRow[] }, userId: string): string {
  if (conv.kind === "PRIVATE") {
    const other = conv.participants.find((p) => p.employeeId !== userId);
    return other ? participantLabel(other) : "Private conversation";
  }
  return conv.subject ?? "Department conversation";
}

const subtitleFor = (conv: { kind: string; participants: ParticipantRow[] }): string =>
  conv.kind === "PRIVATE" ? "Private conversation" : conv.participants.map(participantLabel).join(" ↔ ");

// ───────────── access ─────────────

export type AccessRelation = "participant" | "department" | "hierarchy" | "admin";

/**
 * Loads a conversation ONLY if the user may see it, and works out what they may do in it.
 * Returns null when they may not, which callers must treat exactly like "doesn't exist".
 */
export async function getConversationAccess(user: CurrentUser, conversationId: string) {
  const headed = await getHeadedDepartmentIds(user.id);
  const filter = await conversationVisibilityFilter(user, headed);

  const conversation = await prisma.conversation.findFirst({
    where: { AND: [{ id: conversationId }, filter] },
    include: { participants: { include: participantInclude } },
  });
  if (!conversation) return null;

  const isEmployeeParticipant = conversation.participants.some((p) => p.employeeId === user.id);
  const departments = conversation.participants.flatMap((p) => (p.department ? [p.department] : []));
  const isDepartmentSide = departments.some((d) => d.id === user.departmentId || headed.includes(d.id));

  // Reading is wider than writing: people who see a conversation only through the hierarchy
  // (or as an Admin) can read but not reply. Replying needs to actually be on a side of it.
  const canPost = isEmployeeParticipant || (conversation.kind === "ORGANIZATIONAL" && isDepartmentSide);

  // Department heads may answer AS the department; everyone else answers as themselves.
  const actAsOptions =
    conversation.kind === "ORGANIZATIONAL" && canPost
      ? departments.filter((d) => headed.includes(d.id) || user.role === "ADMIN").map((d) => ({ id: d.id, name: d.name }))
      : [];

  const viaHierarchy = departments.some((d) => d.path.some((ancestorId) => headed.includes(ancestorId)));
  const relation: AccessRelation = isEmployeeParticipant
    ? "participant"
    : isDepartmentSide
      ? "department"
      : viaHierarchy
        ? "hierarchy"
        : "admin";

  return { conversation, canPost, actAsOptions, relation };
}

// ───────────── queries ─────────────

export interface ConversationSummary {
  id: string;
  kind: "PRIVATE" | "ORGANIZATIONAL";
  title: string;
  subtitle: string;
  lastMessageAt: Date;
  preview: string;
}

export async function listConversations(user: CurrentUser, take = 50): Promise<ConversationSummary[]> {
  const filter = await conversationVisibilityFilter(user);
  const rows = await prisma.conversation.findMany({
    where: filter,
    orderBy: { lastMessageAt: "desc" },
    take,
    include: {
      participants: { include: participantInclude },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: {
          sender: { select: { fullName: true } },
          senderDepartment: { select: { name: true } },
          _count: { select: { attachments: true } },
        },
      },
    },
  });

  return rows.map((c) => {
    const last = c.messages[0];
    const who = last ? (last.senderDepartment?.name ?? last.sender.fullName) : "";
    const text = last ? (last.content || (last._count.attachments > 0 ? "Sent an attachment" : "")) : "No messages yet";
    return {
      id: c.id,
      kind: c.kind,
      title: titleFor(c, user.id),
      subtitle: subtitleFor(c),
      lastMessageAt: c.lastMessageAt,
      preview: last ? `${who}: ${text}` : text,
    };
  });
}

export async function getConversationDetail(user: CurrentUser, conversationId: string) {
  const access = await getConversationAccess(user, conversationId);
  if (!access) throw new AppError("NOT_FOUND", "Conversation not found.");

  const newestFirst = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      sender: { select: { id: true, fullName: true } },
      senderDepartment: { select: { id: true, name: true } },
      attachments: { select: { id: true, originalName: true, mimeType: true, size: true } },
    },
  });

  const { conversation } = access;
  return {
    id: conversation.id,
    kind: conversation.kind,
    title: titleFor(conversation, user.id),
    subtitle: subtitleFor(conversation),
    messages: newestFirst.reverse(),
    canPost: access.canPost,
    actAsOptions: access.actAsOptions,
    relation: access.relation,
  };
}

/** Who the user may write to, and which departments they may speak for. */
export async function getComposeOptions(user: CurrentUser) {
  const [employees, departments, headed] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE", NOT: { id: user.id } },
      orderBy: { fullName: "asc" },
      take: 500,
      select: { id: true, fullName: true, position: true },
    }),
    prisma.department.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    getHeadedDepartmentIds(user.id),
  ]);
  const actFor = user.role === "ADMIN" ? departments : departments.filter((d) => headed.includes(d.id));
  return { employees, departments, actFor };
}

// ───────────── commands ─────────────

async function appendMessage(params: {
  conversationId: string;
  senderId: string;
  senderDepartmentId: string | null;
  content: string;
  attachmentIds: string[];
}): Promise<void> {
  // Both writes succeed or neither does, so "last message time" can't drift from the messages.
  await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: params.conversationId,
        senderId: params.senderId,
        senderDepartmentId: params.senderDepartmentId,
        content: params.content,
        attachments: { connect: params.attachmentIds.map((id) => ({ id })) },
      },
      select: { id: true },
    }),
    prisma.conversation.update({ where: { id: params.conversationId }, data: { lastMessageAt: new Date() } }),
  ]);
}

export async function sendMessage(actor: CurrentUser, input: SendMessageInput): Promise<void> {
  const access = await getConversationAccess(actor, input.conversationId);
  if (!access) throw new AppError("NOT_FOUND", "Conversation not found.");
  if (!access.canPost) {
    throw new AppError("FORBIDDEN", "You can read this conversation, but only its participants can reply.");
  }

  let senderDepartmentId: string | null = null;
  if (input.actAsDepartmentId) {
    if (!access.actAsOptions.some((o) => o.id === input.actAsDepartmentId)) {
      throw new AppError("FORBIDDEN", "You can't send on behalf of that department.");
    }
    senderDepartmentId = input.actAsDepartmentId;
  }

  const attachmentIds = await claimableAttachmentIds(actor.id, input.attachmentIds);
  await appendMessage({
    conversationId: input.conversationId,
    senderId: actor.id,
    senderDepartmentId,
    content: input.content,
    attachmentIds,
  });

  // Private conversations are never logged (privacy); department communication is.
  if (access.conversation.kind === "ORGANIZATIONAL") {
    await logActivity({
      actorId: actor.id,
      action: "DEPARTMENT_MESSAGE_SENT",
      entityType: "Conversation",
      entityId: input.conversationId,
      metadata: { attachments: attachmentIds.length, onBehalfOf: senderDepartmentId },
    });
  }
}

export async function startConversation(actor: CurrentUser, input: StartConversationInput): Promise<{ id: string }> {
  const [toType, toId] = input.to.split(":") as ["employee" | "department", string];
  const fromDepartmentId = input.from === "me" ? null : input.from.split(":")[1];

  // Speaking as a department needs authority over it: its head, or an Admin.
  if (fromDepartmentId) {
    const headed = await getHeadedDepartmentIds(actor.id);
    if (!headed.includes(fromDepartmentId) && actor.role !== "ADMIN") {
      throw new AppError("FORBIDDEN", "You can only send on behalf of a department you head.", {
        from: ["You don't head this department"],
      });
    }
    const exists = await prisma.department.findUnique({ where: { id: fromDepartmentId }, select: { id: true } });
    if (!exists) throw new AppError("VALIDATION", "That department doesn't exist.", { from: ["Choose an existing department"] });
  }

  // Validate the recipient.
  if (toType === "employee") {
    const target = await prisma.employee.findUnique({ where: { id: toId }, select: { id: true, status: true } });
    if (!target || target.status !== "ACTIVE") {
      throw new AppError("VALIDATION", "That employee isn't available.", { to: ["Choose an active employee"] });
    }
    if (target.id === actor.id && !fromDepartmentId) {
      throw new AppError("VALIDATION", "You can't message yourself.", { to: ["Choose someone else"] });
    }
  } else {
    const target = await prisma.department.findUnique({ where: { id: toId }, select: { id: true } });
    if (!target) throw new AppError("VALIDATION", "That department doesn't exist.", { to: ["Choose an existing department"] });
    if (fromDepartmentId === toId) {
      throw new AppError("VALIDATION", "A department can't message itself.", { to: ["Choose a different department"] });
    }
  }

  const attachmentIds = await claimableAttachmentIds(actor.id, input.attachmentIds);
  const isPrivate = toType === "employee" && !fromDepartmentId;

  if (!isPrivate && !input.subject) {
    throw new AppError("VALIDATION", "Add a subject so the department knows what this is about.", {
      subject: ["A subject is required for department messages"],
    });
  }

  // ── Employee -> Employee: one private thread per pair, reused forever ──
  if (isPrivate) {
    const threadKey = `dm:${[actor.id, toId].sort().join(":")}`;
    const existing = await prisma.conversation.findUnique({ where: { threadKey }, select: { id: true } });
    if (existing) {
      await appendMessage({ conversationId: existing.id, senderId: actor.id, senderDepartmentId: null, content: input.content, attachmentIds });
      return existing;
    }
    try {
      return await createConversation({
        kind: "PRIVATE",
        threadKey,
        participants: [
          { type: "EMPLOYEE", employeeId: actor.id },
          { type: "EMPLOYEE", employeeId: toId },
        ],
        actor,
        senderDepartmentId: null,
        input,
        attachmentIds,
      });
    } catch (err) {
      // Both people started a chat at the same instant: the unique threadKey stopped the second one. Reuse the first.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const raced = await prisma.conversation.findUnique({ where: { threadKey }, select: { id: true } });
        if (raced) {
          await appendMessage({ conversationId: raced.id, senderId: actor.id, senderDepartmentId: null, content: input.content, attachmentIds });
          return raced;
        }
      }
      throw err;
    }
  }

  // ── Anything involving a department ──
  const participants: Prisma.ConversationParticipantUncheckedCreateWithoutConversationInput[] = [
    fromDepartmentId ? { type: "DEPARTMENT", departmentId: fromDepartmentId } : { type: "EMPLOYEE", employeeId: actor.id },
    toType === "department" ? { type: "DEPARTMENT", departmentId: toId } : { type: "EMPLOYEE", employeeId: toId },
  ];
  const created = await createConversation({
    kind: "ORGANIZATIONAL",
    threadKey: null,
    participants,
    actor,
    senderDepartmentId: fromDepartmentId,
    input,
    attachmentIds,
  });

  await logActivity({
    actorId: actor.id,
    action: "DEPARTMENT_CONVERSATION_STARTED",
    entityType: "Conversation",
    entityId: created.id,
    metadata: { to: input.to, onBehalfOf: fromDepartmentId },
  });
  return created;
}

async function createConversation(params: {
  kind: "PRIVATE" | "ORGANIZATIONAL";
  threadKey: string | null;
  participants: Prisma.ConversationParticipantUncheckedCreateWithoutConversationInput[];
  actor: CurrentUser;
  senderDepartmentId: string | null;
  input: StartConversationInput;
  attachmentIds: string[];
}): Promise<{ id: string }> {
  // One nested write: the conversation, its participants and its first message are created together.
  return prisma.conversation.create({
    data: {
      kind: params.kind,
      // Every conversation needs a unique key: MongoDB's unique index allows only ONE document
      // with an empty value, so department conversations get a random "org:" key instead of null.
      threadKey: params.threadKey ?? `org:${randomUUID()}`,
      subject: params.kind === "PRIVATE" ? null : (params.input.subject ?? null),
      participants: { create: params.participants },
      messages: {
        create: {
          senderId: params.actor.id,
          senderDepartmentId: params.senderDepartmentId,
          content: params.input.content,
          attachments: { connect: params.attachmentIds.map((id) => ({ id })) },
        },
      },
    },
    select: { id: true },
  });
}
