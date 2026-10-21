"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server components on an interval (used while an audit is running). */
export function AutoRefresh({ intervalMs = 5000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [router, intervalMs]);
  return null;
}

/**
 * Asks the server to verify a recent checkout directly with Dodo once, then refreshes
 * if anything changed. Covers delayed or unconfigured webhooks.
 */
export function PendingPaymentSync({ websiteId, status }: { websiteId: string; status: string }) {
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/websites/${websiteId}/sync`, { method: "POST", credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { website?: { status?: string } } | null) => {
        if (!cancelled && data?.website?.status && data.website.status !== status) router.refresh();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [websiteId, status, router]);
  return null;
}
