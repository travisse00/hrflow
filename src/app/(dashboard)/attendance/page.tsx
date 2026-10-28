import Link from "next/link";
import { btnPrimary, btnSecondary, Badge, Card, EmptyState, inputClass, PageHeader, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { dayKeyFor, formatDayKey, formatDuration, formatTime } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { firstParam, type SearchParams } from "@/lib/search-params";
import { attendanceRangeSchema } from "@/lib/validation/attendance";
import { ClockCard } from "@/modules/attendance/components/ClockCard";
import {
  getMyHistory,
  getOrgAttendanceToday,
  getTodayAttendance,
  getTodayRoster,
} from "@/modules/attendance/service";

export const metadata = { title: "Attendance | HRFlow" };

export default async function AttendancePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireUser();
  const sp = await searchParams;

  const parsed = attendanceRangeSchema.safeParse({ from: firstParam(sp.from), to: firstParam(sp.to) });
  const rangeError = parsed.success ? null : parsed.error.issues[0]?.message ?? "Invalid date range";
  const range: { from?: string; to?: string } = parsed.success ? parsed.data : {};

  const isOrgViewer = can(user, "attendance:view-all");
  const [today, history, org, roster] = await Promise.all([
    getTodayAttendance(user.id),
    getMyHistory(user, range.from, range.to),
    isOrgViewer ? getOrgAttendanceToday(user) : Promise.resolve(null),
    isOrgViewer ? getTodayRoster(user) : Promise.resolve(null),
  ]);

  return (
    <>
      <PageHeader title="Attendance" description="Clock in and out, and review your history." />

      <div className="space-y-6">
        <ClockCard today={today} />

        {org && roster && (
          <section aria-labelledby="org-today" className="space-y-4">
            <h2 id="org-today" className="text-lg font-semibold text-foreground">
              Organisation today
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Present" value={org.present} hint={`of ${org.totalActive} active`} />
              <StatCard label="Absent" value={org.absent} />
              <StatCard label="On leave" value={org.onLeave} />
              <StatCard label="Not clocked out" value={org.notClockedOut} />
            </div>
            <Card title="Who clocked in today">
              {roster.length === 0 ? (
                <EmptyState title="Nobody has clocked in yet today" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="py-2 pr-4 font-medium">Employee</th>
                        <th className="py-2 pr-4 font-medium">Department</th>
                        <th className="py-2 pr-4 font-medium">In</th>
                        <th className="py-2 font-medium">Out</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {roster.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2.5 pr-4 font-medium text-foreground">{r.employee.fullName}</td>
                          <td className="py-2.5 pr-4 text-muted">{r.employee.department?.name ?? "None"}</td>
                          <td className="py-2.5 pr-4 text-foreground">{formatTime(r.clockIn)}</td>
                          <td className="py-2.5">{r.clockOut ? formatTime(r.clockOut) : <Badge tone="amber">Still in</Badge>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </section>
        )}

        <section aria-labelledby="my-history" className="space-y-4">
          <h2 id="my-history" className="text-lg font-semibold text-foreground">
            My history
          </h2>

          <Card>
            <form method="get" className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <label htmlFor="from" className="block text-sm font-medium text-foreground">
                  From
                </label>
                <input id="from" name="from" type="date" defaultValue={history.from} max={dayKeyFor()} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="to" className="block text-sm font-medium text-foreground">
                  To
                </label>
                <input id="to" name="to" type="date" defaultValue={history.to} max={dayKeyFor()} className={inputClass} />
              </div>
              <button type="submit" className={btnPrimary}>
                Apply
              </button>
              <Link href="/attendance" className={btnSecondary}>
                Last 30 days
              </Link>
            </form>
            {rangeError && (
              <p role="alert" className="mt-3 text-sm text-danger">
                {rangeError}. Showing the last 30 days instead.
              </p>
            )}
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard label="Days present" value={history.daysPresent} hint={`${formatDayKey(history.from)} to ${formatDayKey(history.to)}`} />
            <StatCard label="Hours worked" value={formatDuration(history.totalMinutes)} hint="Completed days only" />
          </div>

          {history.items.length === 0 ? (
            <EmptyState title="No attendance in this period" description="Pick a different range, or clock in today." />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-border text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">In</th>
                    <th className="px-4 py-3 font-medium">Out</th>
                    <th className="px-4 py-3 font-medium">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {history.items.map((r) => (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-medium text-foreground">{formatDayKey(r.dayKey)}</td>
                      <td className="px-4 py-3 text-foreground">{formatTime(r.clockIn)}</td>
                      <td className="px-4 py-3">
                        {r.clockOut ? formatTime(r.clockOut) : <Badge tone={r.dayKey === dayKeyFor() ? "green" : "amber"}>{r.dayKey === dayKeyFor() ? "In progress" : "No clock-out"}</Badge>}
                      </td>
                      <td className="px-4 py-3 text-muted">{r.minutes === null ? "n/a" : formatDuration(r.minutes)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
