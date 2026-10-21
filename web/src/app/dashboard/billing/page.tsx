import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ManageBillingButton } from "@/components/dashboard/website-actions";
import { Badge, ButtonLink, Card, EmptyState, Notice, PageHeader, Skeleton } from "@/components/ui";
import { getDb } from "@/db";
import { subscriptions, websites } from "@/db/schema";
import { planForProductId } from "@/lib/dodo";
import { formatDate, formatMoney } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Billing" };

const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: "green" | "amber" | "red" | "gray" | "indigo" }> = {
  active: { label: "Active", tone: "green" },
  pending: { label: "Pending", tone: "indigo" },
  past_due: { label: "Past due", tone: "amber" },
  on_hold: { label: "On hold", tone: "red" },
  paused: { label: "Paused", tone: "gray" },
  cancelled: { label: "Cancelled", tone: "gray" },
  expired: { label: "Expired", tone: "gray" },
  failed: { label: "Failed", tone: "red" },
};

export default function BillingPage() {
  return (
    <>
      <PageHeader
        title="Billing"
        description="Each website has its own subscription. Payments, invoices and payment methods are managed by Dodo Payments."
      />
      <Suspense fallback={<Skeleton className="h-64" />}>
        <BillingView />
      </Suspense>
    </>
  );
}

async function BillingView() {
  const user = await requireUser();
  const rows = await getDb()
    .select({
      id: subscriptions.id,
      status: subscriptions.status,
      productId: subscriptions.productId,
      recurringAmount: subscriptions.recurringAmount,
      currency: subscriptions.currency,
      nextBillingDate: subscriptions.nextBillingDate,
      cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
      isDuplicate: subscriptions.isDuplicate,
      websiteId: websites.id,
      domain: websites.domain,
    })
    .from(subscriptions)
    .leftJoin(websites, eq(websites.id, subscriptions.websiteId))
    .where(eq(subscriptions.userId, user.id))
    .orderBy(desc(subscriptions.createdAt));

  return (
    <div className="space-y-6">
      <Card className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Payment methods &amp; invoices</h2>
          <p className="mt-1 text-sm text-slate-600">
            Update your card, download invoices or cancel subscriptions in the secure customer portal.
          </p>
        </div>
        {user.dodoCustomerId ? (
          <ManageBillingButton label="Open billing portal" variant="primary" />
        ) : (
          <ButtonLink href="/dashboard/websites/new" variant="secondary" size="sm">
            Choose a plan
          </ButtonLink>
        )}
      </Card>

      {rows.some((r) => r.isDuplicate && ["active", "past_due", "on_hold", "paused"].includes(r.status)) && (
        <Notice tone="amber" title="You have a duplicate subscription">
          You paid twice for the same website. Cancel the duplicate in the billing portal and contact us for a refund of the
          extra charge.
        </Notice>
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No subscriptions yet"
          description="Subscriptions appear here after your first checkout."
          action={<ButtonLink href="/dashboard/websites/new">Add a website</ButtonLink>}
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Website</th>
                <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Price</th>
                <th scope="col" className="px-4 py-3 font-medium">Renews</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => {
                const plan = planForProductId(row.productId);
                const status = SUBSCRIPTION_STATUS[row.status] ?? { label: row.status, tone: "gray" as const };
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">
                      {row.websiteId ? (
                        <Link href={`/dashboard/websites/${row.websiteId}`} className="font-medium text-indigo-600 hover:underline">
                          {row.domain}
                        </Link>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                      {row.isDuplicate && (
                        <Badge tone="amber" className="ml-2">
                          Duplicate
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-700">{plan ? PLANS[plan].name : "-"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={status.tone}>{status.label}</Badge>
                      {row.cancelAtPeriodEnd && <span className="ml-2 text-xs text-slate-500">cancels at period end</span>}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {formatMoney(row.recurringAmount, row.currency)}
                      <span className="text-slate-400">/mo</span>
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {["active", "past_due"].includes(row.status) && !row.cancelAtPeriodEnd ? formatDate(row.nextBillingDate) : "-"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
