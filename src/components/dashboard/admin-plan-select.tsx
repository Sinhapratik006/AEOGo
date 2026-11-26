"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import type { PlanId } from "@/lib/constants";
import { Spinner } from "../form";
import { buttonClasses, cn } from "../ui";

/** Admin control: pick a plan for one website and apply it. */
export function AdminPlanSelect({
  websiteId,
  domain,
  currentPlan,
  plans,
}: {
  websiteId: string;
  domain: string;
  currentPlan: PlanId;
  plans: Array<{ id: PlanId; name: string }>;
}) {
  const router = useRouter();
  const [plan, setPlan] = useState<PlanId>(currentPlan);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function apply() {
    setPending(true);
    setMessage(null);
    try {
      await api(`/api/admin/websites/${websiteId}/plan`, { body: { plan } });
      setMessage({ ok: true, text: "Saved" });
      router.refresh();
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err) });
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor={`plan-${websiteId}`} className="sr-only">
        Plan for {domain}
      </label>
      <select
        id={`plan-${websiteId}`}
        value={plan}
        onChange={(e) => setPlan(e.target.value as PlanId)}
        className="rounded-lg border-0 bg-transparent py-1.5 pr-8 pl-3 text-sm text-ink-900 ring-1 ring-ink-300 ring-inset focus:ring-2 focus:ring-aurora-600 focus:outline-none"
      >
        {plans.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={apply}
        disabled={pending}
        className={cn(buttonClasses("primary", "sm"), "gap-1.5")}
      >
        {pending && <Spinner />}
        Apply
      </button>
      {message && (
        <span role="status" className={cn("text-xs", message.ok ? "text-emerald-600" : "text-rose-600")}>
          {message.text}
        </span>
      )}
    </div>
  );
}
