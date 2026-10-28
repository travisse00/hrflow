"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Near-realtime updates without a websocket: re-fetch the server-rendered page every few
 * seconds while the tab is visible. Component state (a half-typed reply) is preserved.
 * The seam for true realtime (Socket.io / Pusher) is: replace this with a subscription that
 * calls router.refresh() when an event arrives.
 */
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(timer);
  }, [router, intervalMs]);
  return null;
}
