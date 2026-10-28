"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { FormAlert } from "@/components/forms/FormAlert";
import { btnPrimary, inputClass } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";
import { startConversationAction } from "../actions";
import { AttachmentPicker } from "./AttachmentPicker";
import { useUploads } from "./useUploads";

interface NewConversationFormProps {
  employees: { id: string; fullName: string; position: string }[];
  departments: { id: string; name: string }[];
  /** Departments the user may speak for (the ones they head; all of them for an Admin). */
  actFor: { id: string; name: string }[];
}

export function NewConversationForm({ employees, departments, actFor }: NewConversationFormProps) {
  const uploads = useUploads();
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("me");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(startConversationAction, null);

  const errors = state && !state.ok ? state.error.fieldErrors : undefined;
  const isPrivate = from === "me" && to.startsWith("employee:");
  const canSend = !pending && !uploads.uploading;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    const formData = new FormData();
    formData.set("to", to);
    formData.set("from", from);
    formData.set("subject", subject);
    formData.set("content", content);
    for (const id of uploads.attachmentIds) formData.append("attachmentIds", id);
    startTransition(() => formAction(formData)); // on success the action redirects to the new conversation
  }

  const fieldClass = (name: string) => `${inputClass} ${errors?.[name] ? "border-danger" : ""}`;
  const err = (name: string) => {
    const message = errors?.[name]?.[0];
    return message ? <p className="text-xs text-danger">{message}</p> : null;
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <FormAlert result={state} />

      {actFor.length > 0 && (
        <div className="space-y-1.5">
          <label htmlFor="from" className="block text-sm font-medium text-foreground">
            From
          </label>
          <select id="from" value={from} onChange={(e) => setFrom(e.target.value)} className={fieldClass("from")}>
            <option value="me">Myself</option>
            {actFor.map((d) => (
              <option key={d.id} value={`department:${d.id}`}>
                {d.name} (department)
              </option>
            ))}
          </select>
          {err("from")}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="to" className="block text-sm font-medium text-foreground">
          To
        </label>
        <select id="to" value={to} onChange={(e) => setTo(e.target.value)} className={fieldClass("to")}>
          <option value="">Choose a recipient</option>
          <optgroup label="Departments">
            {departments.map((d) => (
              <option key={d.id} value={`department:${d.id}`}>
                {d.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Employees">
            {employees.map((e) => (
              <option key={e.id} value={`employee:${e.id}`}>
                {e.fullName} · {e.position}
              </option>
            ))}
          </optgroup>
        </select>
        {err("to")}
      </div>

      {to && (
        <p className="rounded-lg bg-soft px-3 py-2 text-xs text-primary-text">
          {isPrivate
            ? "This will be a private conversation. Only you and the recipient can see it."
            : "This is a department conversation. Members and heads of the departments involved, and the heads above them, can see it."}
        </p>
      )}

      {!isPrivate && (
        <div className="space-y-1.5">
          <label htmlFor="subject" className="block text-sm font-medium text-foreground">
            Subject
          </label>
          <input id="subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={120} className={fieldClass("subject")} />
          {err("subject")}
        </div>
      )}

      <div className="space-y-1.5">
        <label htmlFor="content" className="block text-sm font-medium text-foreground">
          Message
        </label>
        <textarea id="content" rows={5} value={content} onChange={(e) => setContent(e.target.value)} maxLength={4000} className={fieldClass("content")} />
        {err("content")}
      </div>

      <AttachmentPicker uploads={uploads} />

      <button type="submit" disabled={!canSend} className={btnPrimary}>
        {pending ? "Sending..." : uploads.uploading ? "Uploading files..." : "Send message"}
      </button>
    </form>
  );
}
