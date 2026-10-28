"use client";

import { btnPrimary } from "@/components/ui";

// Catches anything unexpected thrown while rendering a page in (dashboard).
// Details stay in the server logs; the user only sees a safe message.
export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-2xl border border-danger-border bg-danger-bg p-6 text-center">
      <h1 className="text-lg font-semibold text-danger">Something went wrong</h1>
      <p className="mt-1 text-sm text-muted">We couldn&apos;t load this page. Check your connection and try again.</p>
      <button type="button" onClick={reset} className={`${btnPrimary} mt-4`}>
        Try again
      </button>
    </div>
  );
}
