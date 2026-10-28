import { ActionForm } from "@/components/forms/ActionForm";
import { Badge, Card } from "@/components/ui";
import { formatTime } from "@/lib/dates";
import { clockInAction, clockOutAction } from "../actions";
import type { TodayAttendance } from "../service";

export function ClockCard({ today }: { today: TodayAttendance }) {
  return (
    <Card title="Today">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1.5">
          {today.state === "NOT_STARTED" && (
            <>
              <Badge tone="gray">Not clocked in</Badge>
              <p className="text-sm text-muted">Clock in to start your day.</p>
            </>
          )}
          {today.state === "CLOCKED_IN" && today.clockIn && (
            <>
              <Badge tone="green">Clocked in</Badge>
              <p className="text-sm text-foreground">Since {formatTime(today.clockIn)}</p>
            </>
          )}
          {today.state === "CLOCKED_OUT" && today.clockIn && today.clockOut && (
            <>
              <Badge tone="gray">Day complete</Badge>
              <p className="text-sm text-foreground">
                {formatTime(today.clockIn)} to {formatTime(today.clockOut)}
              </p>
            </>
          )}
        </div>

        {today.state === "NOT_STARTED" && (
          <ActionForm action={clockInAction} submitLabel="Clock in" pendingLabel="Clocking in..." className="" />
        )}
        {today.state === "CLOCKED_IN" && (
          <ActionForm action={clockOutAction} submitLabel="Clock out" pendingLabel="Clocking out..." variant="secondary" className="" />
        )}
      </div>
    </Card>
  );
}
