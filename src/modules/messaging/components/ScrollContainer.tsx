"use client";

import { useEffect, useRef, type ReactNode } from "react";

/** A scrolling box that jumps to the newest message when `watch` changes (a new message arrived). */
export function ScrollContainer({ watch, className, children }: { watch: number; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [watch]);
  return (
    <div ref={ref} className={className} role="log" aria-live="polite" aria-label="Messages">
      {children}
    </div>
  );
}
