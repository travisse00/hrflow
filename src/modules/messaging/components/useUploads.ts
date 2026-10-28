"use client";

import { useCallback, useRef, useState } from "react";
import { checkUploadMeta, MAX_FILES_PER_MESSAGE } from "@/lib/validation/upload";

export interface UploadItem {
  localId: string;
  name: string;
  size: number;
  progress: number; // 0-100
  status: "uploading" | "done" | "error";
  error?: string;
  attachmentId?: string;
}

interface UploadedFile {
  id: string;
}

// XMLHttpRequest (not fetch) because it is the only browser API that reports upload progress.
function uploadFile(file: File, onProgress: (percent: number) => void): Promise<UploadedFile> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/attachments");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      let body: { id?: string; error?: string } = {};
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        /* non-JSON response: fall through to the generic error */
      }
      if (xhr.status >= 200 && xhr.status < 300 && body.id) resolve({ id: body.id });
      else reject(new Error(body.error ?? "Upload failed. Please try again."));
    };
    xhr.onerror = () => reject(new Error("Network error. Check your connection and try again."));
    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}

let counter = 0;

export function useUploads() {
  const [items, setItems] = useState<UploadItem[]>([]);
  const ref = useRef<UploadItem[]>([]); // always-current copy, so async progress updates never use stale state

  const commit = useCallback((next: UploadItem[]) => {
    ref.current = next;
    setItems(next);
  }, []);

  const patch = useCallback(
    (localId: string, changes: Partial<UploadItem>) => {
      commit(ref.current.map((i) => (i.localId === localId ? { ...i, ...changes } : i)));
    },
    [commit],
  );

  const add = useCallback(
    (files: File[]) => {
      let next = ref.current;
      for (const file of files) {
        const localId = `u${++counter}`;
        const base = { localId, name: file.name, size: file.size, progress: 0 };
        const active = next.filter((i) => i.status !== "error").length;

        if (active >= MAX_FILES_PER_MESSAGE) {
          next = [...next, { ...base, status: "error", error: `You can attach up to ${MAX_FILES_PER_MESSAGE} files.` }];
          continue;
        }
        const check = checkUploadMeta(file.name, file.size);
        if (!check.ok) {
          next = [...next, { ...base, status: "error", error: check.message }];
          continue;
        }
        next = [...next, { ...base, status: "uploading" }];
        uploadFile(file, (progress) => patch(localId, { progress }))
          .then((uploaded) => patch(localId, { status: "done", progress: 100, attachmentId: uploaded.id }))
          .catch((err: unknown) =>
            patch(localId, { status: "error", error: err instanceof Error ? err.message : "Upload failed." }),
          );
      }
      commit(next);
    },
    [commit, patch],
  );

  const remove = useCallback((localId: string) => commit(ref.current.filter((i) => i.localId !== localId)), [commit]);
  const reset = useCallback(() => commit([]), [commit]);

  return {
    items,
    add,
    remove,
    reset,
    uploading: items.some((i) => i.status === "uploading"),
    attachmentIds: items.flatMap((i) => (i.status === "done" && i.attachmentId ? [i.attachmentId] : [])),
  };
}

export type Uploads = ReturnType<typeof useUploads>;
