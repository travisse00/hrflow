"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge, EmptyState } from "@/components/ui";

export interface ConversationListItem {
  id: string;
  kind: "PRIVATE" | "ORGANIZATIONAL";
  title: string;
  subtitle: string;
  preview: string;
  timeLabel: string; // formatted on the server so server and browser always agree
}

export function ConversationListView({ items }: { items: ConversationListItem[] }) {
  const pathname = usePathname();

  if (items.length === 0) {
    return <EmptyState title="No conversations yet" description="Start one with a colleague or a department." />;
  }

  return (
    <ul className="space-y-1.5">
      {items.map((c) => {
        const active = pathname === `/messages/${c.id}`;
        return (
          <li key={c.id}>
            <Link
              href={`/messages/${c.id}`}
              aria-current={active ? "page" : undefined}
              className={`block rounded-xl border px-3 py-2.5 transition ${
                active ? "border-primary bg-soft" : "border-border bg-surface hover:bg-soft/60"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate text-sm font-semibold text-foreground">{c.title}</p>
                <span className="shrink-0 text-[11px] text-muted">{c.timeLabel}</span>
              </div>
              <p className="mt-0.5 truncate text-xs text-muted">{c.preview}</p>
              <div className="mt-1.5">
                <Badge tone={c.kind === "PRIVATE" ? "gray" : "green"}>{c.kind === "PRIVATE" ? "Private" : "Department"}</Badge>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
