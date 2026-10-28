"use client";

import { useState, useTransition, type FormEvent, type KeyboardEvent } from "react";
import { FormAlert } from "@/components/forms/FormAlert";
import { btnPrimary, inputClass } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";
import { sendMessageAction } from "../actions";
import { AttachmentPicker } from "./AttachmentPicker";
import { useUploads } from "./useUploads";

interface MessageComposerProps {
  conversationId: string;
  /** Departments the user may answer as (they head them). Empty = reply as yourself only. */
  actAsOptions: { id: string; name: string }[];
}

export function MessageComposer({ conversationId, actAsOptions }: MessageComposerProps) {
  const uploads = useUploads();
  const [content, setContent] = useState("");
  const [actAs, setActAs] = useState("");
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const contentError = result && !result.ok ? result.error.fieldErrors?.content?.[0] : undefined;
  const canSend = !pending && !uploads.uploading && (content.trim().length > 0 || uploads.attachmentIds.length > 0);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;

    const formData = new FormData();
    formData.set("conversationId", conversationId);
    formData.set("content", content);
    formData.set("actAsDepartmentId", actAs);
    for (const id of uploads.attachmentIds) formData.append("attachmentIds", id);

    startTransition(async () => {
      const outcome = await sendMessageAction(null, formData);
      setResult(outcome);
      // Clear the box only after the server confirms the message was saved.
      if (outcome.ok) {
        setContent("");
        uploads.reset();
      }
    });
  }

  // Enter sends, Shift+Enter adds a new line.
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-border p-3">
      <FormAlert result={result} />
      {actAsOptions.length > 0 && (
        <div className="flex items-center gap-2 text-sm">
          <label htmlFor="actAs" className="text-muted">
            Send as
          </label>
          <select id="actAs" value={actAs} onChange={(e) => setActAs(e.target.value)} className={`${inputClass} !w-auto !py-1.5`}>
            <option value="">Myself</option>
            {actAsOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} (department)
              </option>
            ))}
          </select>
        </div>
      )}
      <label htmlFor="message" className="sr-only">
        Message
      </label>
      <textarea
        id="message"
        value={content}
        onChange={(e) => setContent(e.target.value)}
        onKeyDown={onKeyDown}
        rows={2}
        maxLength={4000}
        placeholder="Write a message. Enter to send, Shift+Enter for a new line."
        aria-invalid={contentError ? true : undefined}
        className={`${inputClass} resize-none ${contentError ? "border-danger" : ""}`}
      />
      {contentError && <p className="text-xs text-danger">{contentError}</p>}
      <AttachmentPicker uploads={uploads} />
      <div className="flex justify-end">
        <button type="submit" disabled={!canSend} className={btnPrimary}>
          {pending ? "Sending..." : uploads.uploading ? "Uploading..." : "Send"}
        </button>
      </div>
    </form>
  );
}