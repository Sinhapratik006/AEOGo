"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { AUTOMATION_STATUSES, type WebsiteStatus } from "@/lib/constants";
import { Spinner } from "../form";
import { buttonClasses, CheckIcon, cn } from "../ui";
import { CheckoutButton } from "./website-actions";

interface StatusResponse {
  website: { status: WebsiteStatus };
}

const POLL_INTERVAL_MS = 3000;
const GIVE_UP_AFTER_MS = 3 * 60 * 1000;

export function CheckoutStatus({
  websiteId,
  domain,
  initialStatus,
  paymentStatus,
}: {
  websiteId: string;
  domain: string;
  initialStatus: WebsiteStatus;
  paymentStatus: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<WebsiteStatus>(initialStatus);
  const [timedOut, setTimedOut] = useState(false);
  const startedAt = useRef<number | null>(null);

  const active = AUTOMATION_STATUSES.includes(status);
  const failed = !active && (status === "payment_failed" || paymentStatus === "failed" || paymentStatus === "cancelled");

  useEffect(() => {
    if (active || failed) return;
    startedAt.current ??= Date.now();
    let cancelled = false;
    let timer: number | undefined;

    async function poll() {
      try {
        const data = await api<StatusResponse>(`/api/websites/${websiteId}/sync`, { body: {} });
        if (cancelled) return;
        setStatus(data.website.status);
        if (AUTOMATION_STATUSES.includes(data.website.status)) return;
      } catch {
        // Keep polling; transient errors are expected while the payment settles.
      }
      if (cancelled) return;
      if (Date.now() - (startedAt.current ?? Date.now()) > GIVE_UP_AFTER_MS) {
        setTimedOut(true);
        return;
      }
      timer = window.setTimeout(poll, POLL_INTERVAL_MS);
    }
    void poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [websiteId, active, failed]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => router.push(`/dashboard/websites/${websiteId}`), 2500);
    return () => window.clearTimeout(timer);
  }, [active, router, websiteId]);

  if (failed) {
    return (
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Payment didn&apos;t go through</h1>
        <p className="mt-2 text-sm text-slate-600">
          No charge was made for {domain}. You can try again with the same or a different payment method.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <CheckoutButton websiteId={websiteId} label="Try again" />
          <Link href="/dashboard" className={buttonClasses("secondary", "sm")}>
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Activation and the first audit are queued in the same database transaction.
  const steps = [
    { label: "Payment received", done: true },
    { label: "Subscription activated", done: active },
    { label: "First AEO audit started", done: active },
  ];

  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-slate-900">{active ? "You're all set!" : "Confirming your payment…"}</h1>
      <p className="mt-2 text-sm text-slate-600">
        {active
          ? `The AEO automation for ${domain} is running. Taking you to your dashboard…`
          : "This usually takes a few seconds. Please keep this page open."}
      </p>
      <ol className="mx-auto mt-8 max-w-xs space-y-4 text-left">
        {steps.map((step, index) => {
          const current = !step.done && steps.slice(0, index).every((s) => s.done);
          return (
            <li key={step.label} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full",
                  step.done ? "bg-emerald-600 text-white" : current ? "bg-indigo-100 text-indigo-600" : "bg-slate-100 text-slate-400",
                )}
              >
                {step.done ? <CheckIcon className="h-4 w-4" /> : current ? <Spinner /> : index + 1}
              </span>
              <span className={cn("text-sm", step.done ? "font-medium text-slate-900" : "text-slate-500")}>{step.label}</span>
            </li>
          );
        })}
      </ol>
      {timedOut && !active && (
        <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          This is taking longer than usual. Your payment is still being confirmed by the payment provider (some payment
          methods take a few minutes). We&apos;ll start the audit automatically and email you, so it&apos;s safe to leave
          this page.
        </div>
      )}
      <div className="mt-8">
        <Link href={`/dashboard/websites/${websiteId}`} className={buttonClasses(active ? "primary" : "secondary", "sm")}>
          Go to {domain}
        </Link>
      </div>
    </div>
  );
}
