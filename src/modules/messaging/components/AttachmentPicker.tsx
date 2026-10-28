"use client";

import { useRef, useState } from "react";
import { ACCEPT_ATTRIBUTE, formatBytes } from "@/lib/validation/upload";
import type { Uploads } from "./useUploads";

/** Attach button + drag-and-drop zone + a list of files with live progress. */
export function AttachmentPicker({ uploads }: { uploads: Uploads }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        uploads.add(Array.from(e.dataTransfer.files));
      }}
      className={`rounded-lg border border-dashed px-3 py-2 transition ${dragging ? "border-primary bg-soft" : "border-border"}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPT_ATTRIBUTE}
        className="sr-only"
        aria-label="Attach files"
        onChange={(e) => {
          uploads.add(Array.from(e.target.files ?? []));
          e.target.value = ""; // allows choosing the same file again
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="text-sm font-medium text-primary-text hover:underline"
      >
        Attach files
      </button>
      <span className="ml-2 text-xs text-muted">or drop them here · PDF, images, Office files · up to 10 MB each</span>

      {uploads.items.length > 0 && (
        <ul className="mt-2 space-y-2" aria-live="polite">
          {uploads.items.map((item) => (
            <li key={item.localId} className="text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-foreground">
                  {item.name} <span className="text-xs text-muted">({formatBytes(item.size)})</span>
                </span>
                <button
                  type="button"
                  onClick={() => uploads.remove(item.localId)}
                  className="shrink-0 text-xs text-muted hover:text-danger"
                  aria-label={`Remove ${item.name}`}
                >
                  Remove
                </button>
              </div>
              {item.status === "uploading" && (
                <div
                  className="mt-1 h-1.5 overflow-hidden rounded-full bg-border"
                  role="progressbar"
                  aria-valuenow={item.progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label={`Uploading ${item.name}`}
                >
                  <div className="h-full bg-primary transition-all" style={{ width: `${item.progress}%` }} />
                </div>
              )}
              {item.status === "done" && <p className="text-xs text-primary-text">Ready to send</p>}
              {item.status === "error" && <p className="text-xs text-danger">{item.error}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
