"use client";

import { buttonClasses } from "@/components/ui";

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Something went wrong</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        We couldn&apos;t load this page. Please try again in a moment.
        {error.digest && <span className="mt-2 block text-xs text-slate-400">Reference: {error.digest}</span>}
      </p>
      <button type="button" onClick={reset} className={`${buttonClasses("primary", "sm")} mt-6`}>
        Try again
      </button>
    </div>
  );
}
