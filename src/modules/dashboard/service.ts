import type { CurrentUser } from "@/lib/auth/current-user";
import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/permissions";
import { getAttendanceTrend, getOrgAttendanceToday, getTodayAttendance } from "../attendance/service";
import { countPendingLeave } from "../leave/service";
import { listConversations } from "../messaging/service";

/**
 * The dashboard is assembled per role. Everyone gets their own information; the
 * organisation-wide section is only built (and queried) for people with the permission,
 * so it never even reaches an ordinary employee's page.
 */

const ACTION_LABELS: Record<string, string> = {
  EMPLOYEE_REGISTERED: "created an account",
  EMPLOYEE_CREATED: "added an employee",
  EMPLOYEE_UPDATED: "updated an employee",
  EMPLOYEE_DEACTIVATED: "deactivated an employee",
  EMPLOYEE_REACTIVATED: "reactivated an employee",
  EMPLOYEE_ASSIGNED_TO_DEPARTMENT: "assigned an employee to a department",
  DEPARTMENT_CREATED: "created a department",
  DEPARTMENT_UPDATED: "updated a department",
  DEPARTMENT_MOVED: "moved a department",
  ATTENDANCE_CLOCK_IN: "clocked in",
  ATTENDANCE_CLOCK_OUT: "clocked out",
  LEAVE_SUBMITTED: "requested leave",
  LEAVE_APPROVED: "approved a leave request",
  LEAVE_REJECTED: "rejected a leave request",
  DEPARTMENT_CONVERSATION_STARTED: "started a department conversation",
  DEPARTMENT_MESSAGE_SENT: "sent a department message",
};

export const describeAction = (action: string): string => ACTION_LABELS[action] ?? action.toLowerCase().replaceAll("_", " ");

export async function getDashboardData(user: CurrentUser) {
  const isOrgViewer = can(user, "employee:view-all") && can(user, "attendance:view-all");
  const canSeeAudit = can(user, "audit:view");

  const [today, recentMessages, myPendingLeave, activity] = await Promise.all([
    getTodayAttendance(user.id),
    listConversations(user, 5),
    prisma.leaveRequest.count({ where: { requesterId: user.id, status: "PENDING" } }),
    // HR/Admin see organisation activity; everyone else sees only their own actions.
    prisma.auditLog.findMany({
      where: { action: { not: "LOGIN" }, ...(canSeeAudit ? {} : { actorId: user.id }) },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, action: true, createdAt: true, actor: { select: { fullName: true } } },
    }),
  ]);

  const org = isOrgViewer ? await getOrgSection(user) : null;

  return { today, recentMessages, myPendingLeave, activity, org };
}

async function getOrgSection(user: CurrentUser) {
  const [attendance, trend, pendingLeave, totalDepartments, byDepartment] = await Promise.all([
    getOrgAttendanceToday(user),
    getAttendanceTrend(user, 7),
    countPendingLeave(),
    prisma.department.count(),
    prisma.department.findMany({
      orderBy: { members: { _count: "desc" } },
      take: 6,
      select: { id: true, name: true, _count: { select: { members: true } } },
    }),
  ]);

  return {
    totalEmployees: attendance.totalActive,
    attendance,
    trend,
    pendingLeave,
    totalDepartments,
    byDepartment: byDepartment.map((d) => ({ id: d.id, name: d.name, count: d._count.members })),
  };
}
