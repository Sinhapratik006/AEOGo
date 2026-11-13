"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import type { PlanId } from "@/lib/constants";
import { auditIntervalLabel, PLAN_LIST, PLANS } from "@/lib/plans";
import { Field, FormError, Spinner } from "../form";
import { Badge, buttonClasses, CheckIcon, cn } from "../ui";

export function AddWebsiteForm({ initialPlan, initialUrl }: { initialPlan: PlanId; initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [plan, setPlan] = useState<PlanId>(initialPlan);
  const [error, setError] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [unreachable, setUnreachable] = useState<string | null>(null);
  const [existingWebsiteId, setExistingWebsiteId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function startCheckout(skipReachabilityCheck: boolean) {
    setError(null);
    setUrlError(null);
    setExistingWebsiteId(null);
    setPending(true);
    try {
      const res = await api<{ checkoutUrl: string }>("/api/websites", {
        body: { url, plan, skipReachabilityCheck },
      });
      window.location.assign(res.checkoutUrl);
    } catch (err) {
      setPending(false);
      if (err instanceof ApiError && err.code === "UNREACHABLE") {
        setUnreachable(err.message);
        return;
      }
      setUnreachable(null);
      if (err instanceof ApiError && err.code === "ALREADY_SUBSCRIBED" && typeof err.data.websiteId === "string") {
        setExistingWebsiteId(err.data.websiteId);
      }
      if (err instanceof ApiError && err.field === "url") setUrlError(err.message);
      else setError(errorMessage(err));
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!url.trim()) {
      setUrlError("Enter your website address.");
      return;
    }
    void startCheckout(false);
  }

  const selected = PLANS[plan];

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">1. Your website</h2>
        <p className="mt-1 text-sm text-slate-600">We&apos;ll audit the whole site, starting from its homepage.</p>
        <Field
          id="url"
          name="url"
          label="Website address"
          placeholder="example.com"
          inputMode="url"
          autoComplete="url"
          autoFocus={!initialUrl}
          className="mt-5 max-w-lg"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setUnreachable(null);
            setUrlError(null);
          }}
          error={urlError}
          required
        />
        {existingWebsiteId && (
          <p className="mt-3 text-sm">
            <Link href={`/dashboard/websites/${existingWebsiteId}`} className="font-semibold text-indigo-600 hover:text-indigo-500">
              Go to this website&apos;s dashboard →
            </Link>
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">2. Choose a plan</h2>
        <fieldset className="mt-5">
          <legend className="sr-only">Plan</legend>
          <div className="grid gap-4 md:grid-cols-3">
            {PLAN_LIST.map((option) => (
              <label
                key={option.id}
                className={cn(
                  "relative flex cursor-pointer flex-col rounded-xl border p-5 transition",
                  plan === option.id ? "border-indigo-600 bg-indigo-50/40 ring-1 ring-indigo-600" : "border-slate-200 hover:border-slate-300",
                )}
              >
                <input
                  type="radio"
                  name="plan"
                  value={option.id}
                  checked={plan === option.id}
                  onChange={() => setPlan(option.id)}
                  className="sr-only"
                />
                <span className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{option.name}</span>
                  {option.highlighted && <Badge tone="indigo">Popular</Badge>}
                </span>
                <span className="mt-2 text-2xl font-bold text-slate-900">
                  {`$${option.priceMonthly}`}
                  <span className="text-sm font-normal text-slate-500">/mo</span>
                </span>
                <span className="mt-3 flex flex-col gap-1.5 text-sm text-slate-600">
                  <span className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-indigo-600" />
                    Up to {option.maxPages.toLocaleString("en-US")} pages
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-indigo-600" />
                    {auditIntervalLabel(option.auditIntervalHours)} audits
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckIcon className="h-4 w-4 text-indigo-600" />
                    {option.aiDraftsPerAudit} AI fixes per audit
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      {unreachable && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>{unreachable}</p>
          <button
            type="button"
            onClick={() => void startCheckout(true)}
            disabled={pending}
            className={cn(buttonClasses("secondary", "sm"), "mt-3")}
          >
            My site is online, continue anyway
          </button>
        </div>
      )}
      <FormError message={error} />

      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-slate-50 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-slate-600">
          <p className="font-semibold text-slate-900">{`${selected.name} plan · $${selected.priceMonthly}/month`}</p>
          <p className="mt-1">
            You&apos;ll complete payment securely with Dodo Payments. The automation starts as soon as it&apos;s
            confirmed.
          </p>
        </div>
        <button type="submit" disabled={pending} className={buttonClasses("primary", "lg")}>
          {pending && <Spinner />} Continue to checkout
        </button>
      </div>
    </form>
  );
}
