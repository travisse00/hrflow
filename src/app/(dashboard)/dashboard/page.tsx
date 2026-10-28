import Link from "next/link";
import { Badge, btnSecondary, Card, EmptyState, PageHeader, StatCard } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { formatDateTime, weekdayOfKey } from "@/lib/dates";
import { ClockCard } from "@/modules/attendance/components/ClockCard";
import { describeAction, getDashboardData } from "@/modules/dashboard/service";

export const metadata = { title: "Dashboard | HRFlow" };

export default async function DashboardPage() {
  const user = await requireUser();
  const { today, recentMessages, myPendingLeave, activity, org } = await getDashboardData(user);

  const trendMax = org ? Math.max(1, ...org.trend.map((t) => t.count)) : 1;
  const deptMax = org ? Math.max(1, ...org.byDepartment.map((d) => d.count)) : 1;

  return (
    <>
      <PageHeader title={`Welcome, ${user.fullName.split(" ")[0]}`} description="Here's what's happening today." />

      <div className="space-y-6">
        {org && (
          <section aria-label="Organisation overview" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Total employees" value={org.totalEmployees} hint="Active accounts" />
            <StatCard label="Present today" value={org.attendance.present} hint={`${org.attendance.absent} absent · ${org.attendance.onLeave} on leave`} />
            <StatCard label="Pending leave" value={org.pendingLeave} hint="Waiting for a decision" />
            <StatCard label="Departments" value={org.totalDepartments} />
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <ClockCard today={today} />

            <Card
              title="Recent messages"
              description="Conversations you can see."
            >
              {recentMessages.length === 0 ? (
                <EmptyState
                  title="No messages yet"
                  action={
                    <Link href="/messages/new" className={btnSecondary}>
                      Start a conversation
                    </Link>
                  }
                />
              ) : (
                <ul className="divide-y divide-border">
                  {recentMessages.map((c) => (
                    <li key={c.id}>
                      <Link href={`/messages/${c.id}`} className="block py-3 first:pt-0 last:pb-0 hover:opacity-80">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium text-foreground">{c.title}</span>
                          <span className="shrink-0 text-xs text-muted">{formatDateTime(c.lastMessageAt)}</span>
                        </div>
                        <p className="truncate text-xs text-muted">{c.preview}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            {org && (
              <Card title="Attendance, last 7 days" description="People who clocked in each day.">
                <div className="flex h-36 items-end gap-2" role="img" aria-label={`Attendance for the last 7 days: ${org.trend.map((t) => `${weekdayOfKey(t.dayKey)} ${t.count}`).join(", ")}`}>
                  {org.trend.map((t) => (
                    <div key={t.dayKey} className="flex flex-1 flex-col items-center justify-end gap-1">
                      <span className="text-xs font-medium text-foreground">{t.count}</span>
                      <div className="w-full rounded-t-md bg-primary" style={{ height: `${Math.max(4, (t.count / trendMax) * 100)}%` }} />
                      <span className="text-[11px] text-muted">{weekdayOfKey(t.dayKey)}</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card title="My leave">
              <p className="text-sm text-foreground">
                {myPendingLeave === 0 ? "No requests waiting for a decision." : `${myPendingLeave} pending ${myPendingLeave === 1 ? "request" : "requests"}.`}
              </p>
              <Link href="/leave" className={`${btnSecondary} mt-3`}>
                Open leave
              </Link>
            </Card>

            {org && (
              <Card title="People by department" description="Largest departments.">
                {org.byDepartment.length === 0 ? (
                  <EmptyState title="No departments yet" />
                ) : (
                  <ul className="space-y-3">
                    {org.byDepartment.map((d) => (
                      <li key={d.id}>
                        <div className="mb-1 flex justify-between text-sm">
                          <Link href={`/departments/${d.id}`} className="font-medium text-foreground hover:underline">
                            {d.name}
                          </Link>
                          <span className="text-muted">{d.count}</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-border">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${(d.count / deptMax) * 100}%` }} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            <Card title={org ? "Recent activity" : "My recent activity"}>
              {activity.length === 0 ? (
                <EmptyState title="Nothing yet" />
              ) : (
                <ul className="space-y-3">
                  {activity.map((a) => (
                    <li key={a.id} className="text-sm">
                      <p className="text-foreground">
                        <span className="font-medium">{a.actor?.fullName ?? "Someone"}</span> {describeAction(a.action)}
                      </p>
                      <p className="text-xs text-muted">{formatDateTime(a.createdAt)}</p>
                    </li>
                  ))}
                </ul>
              )}
              {!org && <div className="mt-3"><Badge tone="gray">Only your own actions are shown</Badge></div>}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
