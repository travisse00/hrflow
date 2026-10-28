import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui";
import { requireUser } from "@/lib/auth/current-user";
import { isObjectId, orNotFound } from "@/lib/page-guard";
import { AutoRefresh } from "@/modules/messaging/components/AutoRefresh";
import { MessageComposer } from "@/modules/messaging/components/MessageComposer";
import { MessageList } from "@/modules/messaging/components/MessageList";
import { ScrollContainer } from "@/modules/messaging/components/ScrollContainer";
import { getConversationDetail, type AccessRelation } from "@/modules/messaging/service";

export const metadata = { title: "Conversation | HRFlow" };

const RELATION_NOTE: Record<AccessRelation, string | null> = {
  participant: null,
  department: "You're part of this conversation through your department.",
  hierarchy: "Read-only: you can see this because you head a department above the one involved.",
  admin: "Read-only: visible to you as an Admin. Private conversations are never visible to Admins.",
};

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isObjectId(id)) notFound();

  const user = await requireUser();
  const conversation = await orNotFound(getConversationDetail(user, id));
  const note = RELATION_NOTE[conversation.relation];

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <Link href="/messages" className="text-xs text-primary-text hover:underline lg:hidden">
            ← All conversations
          </Link>
          <h1 className="truncate text-lg font-semibold text-foreground">{conversation.title}</h1>
          <p className="truncate text-xs text-muted">{conversation.subtitle}</p>
        </div>
        <Badge tone={conversation.kind === "PRIVATE" ? "gray" : "green"}>
          {conversation.kind === "PRIVATE" ? "Private" : "Department"}
        </Badge>
      </header>

      {note && <p className="border-b border-border bg-soft px-4 py-2 text-xs text-primary-text">{note}</p>}

      <ScrollContainer watch={conversation.messages.length} className="max-h-[55vh] min-h-[240px] overflow-y-auto bg-background p-4">
        <MessageList messages={conversation.messages} currentUserId={user.id} />
      </ScrollContainer>

      {conversation.canPost ? (
        <MessageComposer conversationId={conversation.id} actAsOptions={conversation.actAsOptions} />
      ) : (
        <p className="border-t border-border px-4 py-3 text-sm text-muted">You can read this conversation but can&apos;t reply to it.</p>
      )}

      <AutoRefresh />
    </div>
  );
}
