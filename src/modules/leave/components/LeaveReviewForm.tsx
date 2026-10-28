"use client";

import { startTransition, useActionState, useState } from "react";
import { FormAlert } from "@/components/forms/FormAlert";
import { btnDanger, btnPrimary, inputClass } from "@/components/ui";
import type { ActionResult } from "@/lib/errors";
import { reviewLeaveAction } from "../actions";

/** Approve / Reject with an optional note (required when rejecting). */
export function LeaveReviewForm({ requestId }: { requestId: string }) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(reviewLeaveAction, null);
  const [note, setNote] = useState("");
  const noteError = state && !state.ok ? state.error.fieldErrors?.note?.[0] : undefined;

  function decide(decision: "APPROVED" | "REJECTED") {
    const formData = new FormData();
    formData.set("id", requestId);
    formData.set("decision", decision);
    formData.set("note", note);
    startTransition(() => formAction(formData));
  }

  return (
    <div className="space-y-2">
      <FormAlert result={state} />
      <label htmlFor={`note-${requestId}`} className="sr-only">
        Review note
      </label>
      <input
        id={`note-${requestId}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Note (required if rejecting)"
        maxLength={500}
        aria-invalid={noteError ? true : undefined}
        className={`${inputClass} ${noteError ? "border-danger" : ""}`}
      />
      {noteError && <p className="text-xs text-danger">{noteError}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={pending} onClick={() => decide("APPROVED")} className={btnPrimary}>
          {pending ? "Saving..." : "Approve"}
        </button>
        <button type="button" disabled={pending} onClick={() => decide("REJECTED")} className={btnDanger}>
          Reject
        </button>
      </div>
    </div>
  );
}
