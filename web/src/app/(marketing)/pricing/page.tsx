import type { Metadata } from "next";
import { Faq } from "@/components/marketing/faq";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { auditIntervalLabel, PLAN_LIST } from "@/lib/plans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "AEOGo plans start at $29/month per website: automated AEO audits, AI-written fixes, llms.txt and schema generation, and continuous monitoring.",
};

const ROWS: Array<{ label: string; value: (plan: (typeof PLAN_LIST)[number]) => string }> = [
  { label: "Pages per audit", value: (p) => p.maxPages.toLocaleString("en-US") },
  { label: "Automatic audits", value: (p) => auditIntervalLabel(p.auditIntervalHours) },
  { label: "AI-written fixes per audit", value: (p) => String(p.aiDraftsPerAudit) },
  { label: "On-demand audits per day", value: (p) => String(p.manualAuditsPerDay) },
  { label: "AI crawler & robots.txt checks", value: () => "✓" },
  { label: "llms.txt & schema generator", value: () => "✓" },
  { label: "Score history & email reports", value: () => "✓" },
];

export default function PricingPage() {
  return (
    <>
      <section className="bg-gradient-to-b from-indigo-50/80 to-white">
        <div className="mx-auto max-w-6xl px-4 pt-16 pb-10 text-center sm:px-6">
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Pricing</h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-600">
            One plan per website. Subscribe, enter your URL, and the AEO automation starts immediately.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <PricingCards />
      </section>

      <section className="mx-auto max-w-4xl px-4 pb-20 sm:px-6">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Compare plans</h2>
        <div className="mt-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th scope="col" className="px-5 py-3 font-medium">
                  Feature
                </th>
                {PLAN_LIST.map((plan) => (
                  <th key={plan.id} scope="col" className="px-5 py-3 font-semibold text-slate-900">
                    {plan.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ROWS.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className="px-5 py-3 font-normal text-slate-700">
                    {row.label}
                  </th>
                  {PLAN_LIST.map((plan) => (
                    <td key={plan.id} className="px-5 py-3 text-slate-900">
                      {row.value(plan)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 text-xs text-slate-500">
          Prices in USD, excluding applicable taxes. Payments are processed by Dodo Payments, our merchant of record.
        </p>
      </section>

      <section className="bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">Questions</h2>
          <div className="mt-6">
            <Faq />
          </div>
        </div>
      </section>
    </>
  );
}
