import { EmptyState } from "@/components/ui";
import { formatDateTime } from "@/lib/dates";
import { formatBytes, isInlinePreviewable } from "@/lib/validation/upload";

interface MessageView {
  id: string;
  content: string;
  createdAt: Date;
  sender: { id: string; fullName: string };
  senderDepartment: { id: string; name: string } | null;
  attachments: { id: string; originalName: string; mimeType: string; size: number }[];
}

function Attachment({ file, mine }: { file: MessageView["attachments"][number]; mine: boolean }) {
  const previewable = isInlinePreviewable(file.mimeType);
  const isImage = file.mimeType.startsWith("image/");
  const href = `/api/attachments/${file.id}`;
  const linkClass = mine ? "text-primary-fg underline" : "text-primary-text underline";

  return (
    <div className="mt-2 rounded-lg border border-black/10 bg-black/5 p-2 text-xs">
      {isImage && (
        <a href={href} target="_blank" rel="noopener noreferrer" className="mb-2 block">
          {/* Plain <img> on purpose: next/image would try to optimise a private, authenticated URL. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={href} alt={file.originalName} loading="lazy" className="max-h-56 rounded-md object-contain" />
        </a>
      )}
      <p className="break-all font-medium">{file.originalName}</p>
      <p className="opacity-70">{formatBytes(file.size)}</p>
      <div className="mt-1 flex gap-3">
        {previewable && (
          <a href={href} target="_blank" rel="noopener noreferrer" className={linkClass}>
            Preview
          </a>
        )}
        <a href={`${href}?download=1`} className={linkClass}>
          Download
        </a>
      </div>
    </div>
  );
}

export function MessageList({ messages, currentUserId }: { messages: MessageView[]; currentUserId: string }) {
  if (messages.length === 0) {
    return <EmptyState title="No messages yet" description="Send the first message below." />;
  }

  return (
    <ul className="space-y-3">
      {messages.map((m) => {
        const mine = m.sender.id === currentUserId;
        return (
          <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 sm:max-w-[75%] ${mine ? "bg-primary text-primary-fg" : "border border-border bg-surface text-foreground"}`}>
              <p className={`mb-0.5 text-xs font-semibold ${mine ? "opacity-90" : "text-primary-text"}`}>
                {m.sender.fullName}
                {m.senderDepartment && <span className="font-normal opacity-80"> · on behalf of {m.senderDepartment.name}</span>}
              </p>
              {m.content && <p className="whitespace-pre-wrap break-words text-sm">{m.content}</p>}
              {m.attachments.map((file) => (
                <Attachment key={file.id} file={file} mine={mine} />
              ))}
              <p className={`mt-1 text-right text-[11px] ${mine ? "opacity-80" : "text-muted"}`}>{formatDateTime(m.createdAt)}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
