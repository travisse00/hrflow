import Link from "next/link";
import { btnPrimary } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { ConversationListView } from "@/modules/messaging/components/ConversationListView";
import { listConversations } from "@/modules/messaging/service";

// Two-pane layout: the conversation list is always on the left on desktop. On mobile the list
// is shown on /messages and the open conversation takes the whole screen.
export default async function MessagesLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const conversations = await listConversations(user);

  const items = conversations.map((c) => ({
    id: c.id,
    kind: c.kind,
    title: c.title,
    subtitle: c.subtitle,
    preview: c.preview,
    timeLabel: formatDateTime(c.lastMessageAt),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <aside aria-label="Conversations" className="hidden space-y-3 lg:block">
        <Link href="/messages/new" className={`${btnPrimary} w-full`}>
          New message
        </Link>
        <ConversationListView items={items} />
      </aside>
      <section className="min-w-0">{children}</section>
    </div>
  );
}
