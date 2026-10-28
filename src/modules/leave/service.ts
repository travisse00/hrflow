import type { LeaveStatus, Prisma } from "@prisma/client";
import { logActivity } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/current-user";
import { addDays, dayKeyFor, dayKeyToDate, diffDays, formatDay } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions";
import type { LeaveRequestInput, ReviewLeaveInput } from "@/lib/validation/leave";

/**
 * Leave lifecycle:   PENDING --approve--> APPROVED
 *                    PENDING --reject---> REJECTED
 * APPROVED and REJECTED are final. A decision can only be made once.
 */

const MAX_LEAVE_DAYS = 365;
const SICK_BACKDATE_DAYS = 7; // sick leave can be filed up to a week after the fact

const requestSelect = {
  id: true,
  type: true,
  startDate: true,
  endDate: true,
  reason: true,
  status: true,
  submittedAt: true,
  reviewedAt: true,
  reviewNote: true,
  requester: { select: { id: true, fullName: true, department: { select: { name: true } } } },
  reviewer: { select: { id: true, fullName: true } },
} satisfies Prisma.LeaveRequestSelect;

export type LeaveRequestRow = Prisma.LeaveRequestGetPayload<{ select: typeof requestSelect }>;

export async function submitLeaveRequest(actor: CurrentUser, input: LeaveRequestInput): Promise<{ id: string }> {
  const today = dayKeyFor();

  const earliestStart = input.type === "SICK" ? addDays(today, -SICK_BACKDATE_DAYS) : today;
  if (input.startDate < earliestStart) {
    throw new AppError("VALIDATION", "That start date is in the past.", {
      startDate: [input.type === "SICK" ? "Sick leave can be backdated by at most 7 days" : "Start date can't be in the past"],
    });
  }
  if (diffDays(input.startDate, input.endDate) + 1 > MAX_LEAVE_DAYS) {
    throw new AppError("VALIDATION", "That period is too long.", { endDate: ["A request can cover at most 365 days"] });
  }

  const start = dayKeyToDate(input.startDate);
  const end = dayKeyToDate(input.endDate);

  // Two date ranges overlap when each starts before the other ends.
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      requesterId: actor.id,
      status: { in: ["PENDING", "APPROVED"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { status: true, startDate: true, endDate: true },
  });
  if (overlap) {
    throw new AppError(
      "CONFLICT",
      `This overlaps with your ${overlap.status.toLowerCase()} request for ${formatDay(overlap.startDate)} to ${formatDay(overlap.endDate)}.`,
      { startDate: ["Dates overlap an existing request"] },
    );
  }

  const request = await prisma.leaveRequest.create({
    data: { requesterId: actor.id, type: input.type, startDate: start, endDate: end, reason: input.reason },
    select: { id: true },
  });

  await logActivity({
    actorId: actor.id,
    action: "LEAVE_SUBMITTED",
    entityType: "LeaveRequest",
    entityId: request.id,
    metadata: { type: input.type, startDate: input.startDate, endDate: input.endDate },
  });
  return request;
}

export async function reviewLeaveRequest(actor: CurrentUser, input: ReviewLeaveInput): Promise<void> {
  assertCan(actor, "leave:review");

  const request = await prisma.leaveRequest.findUnique({
    where: { id: input.id },
    select: { id: true, requesterId: true, status: true },
  });
  if (!request) throw new AppError("NOT_FOUND", "Leave request not found.");

  // Nobody approves their own leave, not even an Admin. Four-eyes principle.
  if (request.requesterId === actor.id) {
    throw new AppError("FORBIDDEN", "You can't review your own leave request.");
  }
  if (request.status !== "PENDING") {
    throw new AppError("CONFLICT", `This request was already ${request.status.toLowerCase()}.`);
  }

  // Atomic "only if still pending": if two reviewers click at the same moment, one wins and
  // the other gets count 0 instead of silently overwriting the first decision.
  const updated = await prisma.leaveRequest.updateMany({
    where: { id: input.id, status: "PENDING" },
    data: { status: input.decision, reviewerId: actor.id, reviewedAt: new Date(), reviewNote: input.note ?? null },
  });
  if (updated.count === 0) {
    throw new AppError("CONFLICT", "Someone else just reviewed this request.");
  }

  await logActivity({
    actorId: actor.id,
    action: input.decision === "APPROVED" ? "LEAVE_APPROVED" : "LEAVE_REJECTED",
    entityType: "LeaveRequest",
    entityId: input.id,
    metadata: { requesterId: request.requesterId },
  });
}

// ───────────── queries ─────────────

export function listMyLeave(actor: CurrentUser): Promise<LeaveRequestRow[]> {
  return prisma.leaveRequest.findMany({
    where: { requesterId: actor.id },
    orderBy: { submittedAt: "desc" },
    take: 50,
    select: requestSelect,
  });
}

export async function listLeaveForReview(actor: CurrentUser, status: LeaveStatus | "DECIDED"): Promise<LeaveRequestRow[]> {
  assertCan(actor, "leave:review");

  return prisma.leaveRequest.findMany({
    where: status === "DECIDED" ? { status: { in: ["APPROVED", "REJECTED"] } } : { status },
    orderBy: status === "PENDING" ? { submittedAt: "asc" } : { reviewedAt: "desc" }, // oldest waiting first
    take: status === "PENDING" ? 100 : 25,
    select: requestSelect,
  });
}

export function countPendingLeave(): Promise<number> {
  return prisma.leaveRequest.count({ where: { status: "PENDING" } });
}
