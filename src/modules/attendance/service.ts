import { Prisma } from "@prisma/client";
import { logActivity } from "@/lib/audit";
import type { CurrentUser } from "@/lib/auth/current-user";
import { addDays, dayKeyFor, dayKeyToDate, lastNDayKeys } from "@/lib/dates";
import { prisma } from "@/lib/db/prisma";
import { AppError } from "@/lib/errors";
import { assertCan } from "@/lib/permissions";

/**
 * Attendance state machine (per employee, per calendar day in the organisation's timezone):
 *
 *   NOT_STARTED --clock in--> CLOCKED_IN --clock out--> CLOCKED_OUT   (end of the day)
 *
 * Anything else is rejected. The rules are enforced by the DATABASE, not just by checks in this
 * file, so two requests arriving at the same instant can't both succeed:
 *   - clock in : the unique index (employeeId, dayKey) rejects a second row
 *   - clock out: one atomic "update where clockOut is empty" only ever matches once
 */

// A missing field and an explicit null both mean "not clocked out yet".
const notClockedOut: Prisma.AttendanceWhereInput = {
  OR: [{ clockOut: null }, { clockOut: { isSet: false } }],
};

export type AttendanceState = "NOT_STARTED" | "CLOCKED_IN" | "CLOCKED_OUT";

export interface TodayAttendance {
  state: AttendanceState;
  clockIn: Date | null;
  clockOut: Date | null;
}

export async function getTodayAttendance(employeeId: string): Promise<TodayAttendance> {
  const record = await prisma.attendance.findUnique({
    where: { employeeId_dayKey: { employeeId, dayKey: dayKeyFor() } },
    select: { clockIn: true, clockOut: true },
  });
  if (!record) return { state: "NOT_STARTED", clockIn: null, clockOut: null };
  return { state: record.clockOut ? "CLOCKED_OUT" : "CLOCKED_IN", clockIn: record.clockIn, clockOut: record.clockOut ?? null };
}

export async function clockIn(actor: CurrentUser): Promise<void> {
  const now = new Date();
  try {
    await prisma.attendance.create({
      data: { employeeId: actor.id, dayKey: dayKeyFor(now), clockIn: now, clockOut: null },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw new AppError("CONFLICT", "You've already clocked in today.");
    }
    throw err;
  }
  await logActivity({ actorId: actor.id, action: "ATTENDANCE_CLOCK_IN", entityType: "Attendance" });
}

export async function clockOut(actor: CurrentUser): Promise<void> {
  const now = new Date();
  const dayKey = dayKeyFor(now);

  const result = await prisma.attendance.updateMany({
    where: { employeeId: actor.id, dayKey, ...notClockedOut },
    data: { clockOut: now },
  });

  if (result.count === 0) {
    // Nothing was updated. Work out WHY so the message is helpful.
    const existing = await prisma.attendance.findUnique({
      where: { employeeId_dayKey: { employeeId: actor.id, dayKey } },
      select: { id: true },
    });
    throw new AppError(
      existing ? "CONFLICT" : "VALIDATION",
      existing ? "You've already clocked out today." : "You haven't clocked in today, so there's nothing to clock out of.",
    );
  }
  await logActivity({ actorId: actor.id, action: "ATTENDANCE_CLOCK_OUT", entityType: "Attendance" });
}

export interface AttendanceHistoryRow {
  id: string;
  dayKey: string;
  clockIn: Date;
  clockOut: Date | null;
  minutes: number | null;
}

/** An employee's own history for a period (default: the last 30 days). */
export async function getMyHistory(actor: CurrentUser, from?: string, to?: string) {
  const end = to ?? dayKeyFor();
  // Cap the window at one year so a huge range can't turn into a huge query.
  const earliest = addDays(end, -365);
  const start = from && from > earliest ? from : from ? earliest : addDays(end, -29);

  const rows = await prisma.attendance.findMany({
    where: { employeeId: actor.id, dayKey: { gte: start, lte: end } },
    orderBy: { dayKey: "desc" },
    take: 400,
    select: { id: true, dayKey: true, clockIn: true, clockOut: true },
  });

  const items: AttendanceHistoryRow[] = rows.map((r) => ({
    ...r,
    minutes: r.clockOut ? Math.max(0, Math.round((r.clockOut.getTime() - r.clockIn.getTime()) / 60_000)) : null,
  }));

  return {
    from: start,
    to: end,
    items,
    daysPresent: items.length,
    totalMinutes: items.reduce((sum, r) => sum + (r.minutes ?? 0), 0),
  };
}

export interface OrgAttendanceToday {
  totalActive: number;
  present: number;
  onLeave: number;
  absent: number;
  notClockedOut: number;
}

/** Organisation-wide numbers for today. HR / Admin only. */
export async function getOrgAttendanceToday(actor: CurrentUser): Promise<OrgAttendanceToday> {
  assertCan(actor, "attendance:view-all");

  const today = dayKeyFor();
  const todayDate = dayKeyToDate(today);

  const [totalActive, records, leaves] = await Promise.all([
    prisma.employee.count({ where: { status: "ACTIVE" } }),
    prisma.attendance.findMany({ where: { dayKey: today }, select: { employeeId: true, clockOut: true } }),
    prisma.leaveRequest.findMany({
      where: { status: "APPROVED", startDate: { lte: todayDate }, endDate: { gte: todayDate } },
      select: { requesterId: true },
    }),
  ]);

  const presentIds = new Set(records.map((r) => r.employeeId));
  // Someone on approved leave who clocked in anyway counts as present, not on leave.
  const onLeave = new Set(leaves.map((l) => l.requesterId).filter((id) => !presentIds.has(id))).size;

  return {
    totalActive,
    present: presentIds.size,
    onLeave,
    absent: Math.max(0, totalActive - presentIds.size - onLeave),
    notClockedOut: records.filter((r) => !r.clockOut).length,
  };
}

/** How many people clocked in on each of the last `days` days (oldest first). */
export async function getAttendanceTrend(actor: CurrentUser, days = 7): Promise<{ dayKey: string; count: number }[]> {
  assertCan(actor, "attendance:view-all");

  const keys = lastNDayKeys(days);
  const rows = await prisma.attendance.findMany({
    where: { dayKey: { in: keys } },
    select: { dayKey: true },
  });
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.dayKey, (counts.get(r.dayKey) ?? 0) + 1);
  return keys.map((dayKey) => ({ dayKey, count: counts.get(dayKey) ?? 0 }));
}

/** Everyone's attendance record for today, for the HR roster table. */
export async function getTodayRoster(actor: CurrentUser) {
  assertCan(actor, "attendance:view-all");

  return prisma.attendance.findMany({
    where: { dayKey: dayKeyFor() },
    orderBy: { clockIn: "asc" },
    take: 200,
    select: {
      id: true,
      clockIn: true,
      clockOut: true,
      employee: { select: { id: true, fullName: true, department: { select: { name: true } } } },
    },
  });
}
