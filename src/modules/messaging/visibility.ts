import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";

/**
 * WHO CAN SEE A CONVERSATION. This file is the single source of truth: the conversation
 * list, the conversation page, message sending and the attachment download route all build
 * their access check from the filter below, so the rules can't drift apart.
 *
 * PRIVATE conversations (employee <-> employee)
 *   Visible ONLY to the two participants. No role, no department head, not even an Admin.
 *   The department hierarchy is never consulted for these.
 *
 * ORGANIZATIONAL conversations (anything that involves a department)
 *   Visible to:
 *     1. an employee who is a direct participant (the sender, or the person addressed)
 *     2. members of a participating department
 *     3. the head of a participating department
 *     4. the head of any department ABOVE a participating one (hierarchy resolved upward,
 *        using the stored ancestor `path`), e.g. the HR head sees what Recruitment sends
 *     5. Admins (organisation-wide oversight, read-only)
 */

export async function getHeadedDepartmentIds(userId: string): Promise<string[]> {
  const rows = await prisma.department.findMany({ where: { headId: userId }, select: { id: true } });
  return rows.map((r) => r.id);
}

export async function conversationVisibilityFilter(
  user: CurrentUser,
  headedDepartmentIds?: string[],
): Promise<Prisma.ConversationWhereInput> {
  const headed = headedDepartmentIds ?? (await getHeadedDepartmentIds(user.id));

  // Departments whose conversations I can see directly: the one I belong to + the ones I head.
  const direct = [...headed, ...(user.departmentId ? [user.departmentId] : [])];

  const departmentRules: Prisma.DepartmentWhereInput[] = [];
  if (direct.length > 0) departmentRules.push({ id: { in: direct } });
  // Upward resolution: a participating department is "below" one I head if my department
  // appears in its ancestor path.
  if (headed.length > 0) departmentRules.push({ path: { hasSome: headed } });

  const rules: Prisma.ConversationWhereInput[] = [
    // 1. Direct participant. This is also the ONLY rule that can match a PRIVATE conversation.
    { participants: { some: { employeeId: user.id } } },
  ];

  if (departmentRules.length > 0) {
    rules.push({
      kind: "ORGANIZATIONAL",
      participants: { some: { type: "DEPARTMENT", department: { OR: departmentRules } } },
    });
  }
  if (user.role === "ADMIN") rules.push({ kind: "ORGANIZATIONAL" });

  return { OR: rules };
}
