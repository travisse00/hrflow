import type { ReactNode } from "react";
import { Badge, EmptyState } from "@/components/ui";
import { diffDays, formatDateTime, formatDay } from "@/lib/dates";
import type { LeaveRequestRow } from "../service";

const TYPE_LABEL = {
  ANNUAL: "Annual",
  SICK: "Sick",
  CASUAL: "Casual",
  MATERNITY: "Maternity",
  PATERNITY: "Paternity",
  UNPAID: "Unpaid",
} as const;

const STATUS_TONE = { PENDING: "amber", APPROVED: "green", REJECTED: "red" } as const;
const STATUS_LABEL = { PENDING: "Pending", APPROVED: "Approved", REJECTED: "Rejected" } as const;

const iso = (d: Date) => d.toISOString().slice(0, 10);

interface LeaveListProps {
  requests: LeaveRequestRow[];
  emptyTitle: string;
  showRequester?: boolean;
  /** Extra controls under each request, e.g. the approve/reject form. */
  renderActions?: (request: LeaveRequestRow) => ReactNode;
}

export function LeaveList({ requests, emptyTitle, showRequester = false, renderActions }: LeaveListProps) {
  if (requests.length === 0) return <EmptyState title={emptyTitle} />;

  return (
    <ul className="divide-y divide-border">
      {requests.map((r) => {
        const days = diffDays(iso(r.startDate), iso(r.endDate)) + 1;
        return (
          <li key={r.id} className="space-y-3 py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {showRequester && <span>{r.requester.fullName} · </span>}
                  {TYPE_LABEL[r.type]} leave
                  <span className="font-normal text-muted">
                    {" "}
                    · {days} {days === 1 ? "day" : "days"}
                  </span>
                </p>
                <p className="text-sm text-muted">
                  {formatDay(r.startDate)} to {formatDay(r.endDate)}
                  {showRequester && r.requester.department && ` · ${r.requester.department.name}`}
                </p>
              </div>
              <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
            </div>

            <p className="text-sm text-foreground">{r.reason}</p>

            <p className="text-xs text-muted">
              Submitted {formatDateTime(r.submittedAt)}
              {r.reviewer && r.reviewedAt && ` · ${STATUS_LABEL[r.status]} by ${r.reviewer.fullName} on ${formatDateTime(r.reviewedAt)}`}
              {r.reviewNote && ` · Note: ${r.reviewNote}`}
            </p>

            {renderActions?.(r)}
          </li>
        );
      })}
    </ul>
  );
}
