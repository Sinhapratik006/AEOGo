"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Spinner } from "../form";
import { buttonClasses, cn } from "../ui";

type Variant = "primary" | "secondary" | "ghost" | "danger";

function ActionButton({
  children,
  onAction,
  variant = "secondary",
  confirmText,
  disabled,
}: {
  children: ReactNode;
  onAction: () => Promise<void>;
  variant?: Variant;
  confirmText?: string;
  disabled?: boolean;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setError(null);
    setPending(true);
    try {
      await onAction();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start">
      <button type="button" onClick={run} disabled={disabled || pending} className={buttonClasses(variant, "sm")}>
        {pending && <Spinner />}
        {children}
      </button>
      {error && (
        <span role="alert" className="mt-1 max-w-xs text-xs text-rose-600">
          {error}
        </span>
      )}
    </span>
  );
}

export function RunAuditButton({ websiteId, disabled }: { websiteId: string; disabled?: boolean }) {
  const router = useRouter();
  return (
    <ActionButton
      variant="primary"
      disabled={disabled}
      onAction={async () => {
        await api(`/api/websites/${websiteId}/audit`);
        router.refresh();
      }}
    >
      Run audit now
    </ActionButton>
  );
}

export function CheckoutButton({ websiteId, label, variant = "primary" }: { websiteId: string; label: string; variant?: Variant }) {
  return (
    <ActionButton
      variant={variant}
      onAction={async () => {
        const res = await api<{ checkoutUrl: string }>(`/api/websites/${websiteId}/checkout`, { body: {} });
        window.location.assign(res.checkoutUrl);
        await new Promise(() => undefined); // Keep the spinner while the browser navigates away.
      }}
    >
      {label}
    </ActionButton>
  );
}

export function CancelPlanButton({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  return (
    <ActionButton
      variant="danger"
      confirmText="Cancel this plan? It stays active until the end of the current billing period, then automation stops."
      onAction={async () => {
        await api(`/api/websites/${websiteId}/cancel`, { body: { resume: false } });
        router.refresh();
      }}
    >
      Cancel plan
    </ActionButton>
  );
}

export function ResumePlanButton({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  return (
    <ActionButton
      variant="primary"
      onAction={async () => {
        await api(`/api/websites/${websiteId}/cancel`, { body: { resume: true } });
        router.refresh();
      }}
    >
      Keep my plan
    </ActionButton>
  );
}

export function RemoveWebsiteButton({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  return (
    <ActionButton
      variant="ghost"
      confirmText="Remove this website and its audit history? This can't be undone."
      onAction={async () => {
        await api(`/api/websites/${websiteId}`, { method: "DELETE" });
        router.push("/dashboard");
        router.refresh();
      }}
    >
      Remove website
    </ActionButton>
  );
}

export function ManageBillingButton({ label = "Manage billing", variant = "secondary" }: { label?: string; variant?: Variant }) {
  return (
    <ActionButton
      variant={variant}
      onAction={async () => {
        const res = await api<{ url: string }>("/api/billing/portal");
        window.location.assign(res.url);
        await new Promise(() => undefined);
      }}
    >
      {label}
    </ActionButton>
  );
}

export function ExportLink({ auditId }: { auditId: string }) {
  return (
    <a href={`/api/audits/${auditId}/export`} className={cn(buttonClasses("secondary", "sm"))} download>
      Export CSV
    </a>
  );
}
