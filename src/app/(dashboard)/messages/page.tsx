import Link from "next/link";
import { btnPrimary, EmptyState, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { formatDateTime } from "@/lib/dates";
import { ConversationListView } from "@/modules/messaging/components/ConversationListView";
import { listConversations } from "@/modules/messaging/service";

export const metadata = { title: "Messages | HRFlow" };

export default async function MessagesIndexPage() {
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
    <>
      <PageHeader
        title="Messages"
        description="Private chats and department communication."
        actions={
          <Link href="/messages/new" className={`${btnPrimary} lg:hidden`}>
            New message
          </Link>
        }
      />
      {/* Mobile: the list lives here. Desktop: the list is in the left pane, so show a prompt. */}
      <div className="lg:hidden">
        <ConversationListView items={items} />
      </div>
      <div className="hidden lg:block">
        <EmptyState
          title={items.length === 0 ? "No conversations yet" : "Select a conversation"}
          description={items.length === 0 ? "Start one with a colleague or a department." : "Choose one from the list, or start a new message."}
          action={
            <Link href="/messages/new" className={btnPrimary}>
              New message
            </Link>
          }
        />
      </div>
    </>
  );
}
