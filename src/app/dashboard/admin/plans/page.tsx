import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminPlanSelect } from "@/components/dashboard/admin-plan-select";
import { Badge, Card, PageHeader, Skeleton, StatusBadge } from "@/components/ui";
import { PLAN_LIST } from "@/lib/plans";
import { listWebsitesWithOwners } from "@/lib/server/admin-plans";
import { requireAdmin } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Admin plans" };

export default function AdminPlansPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem]" />}>
      <AdminPlans />
    </Suspense>
  );
}

async function AdminPlans() {
  await requireAdmin();
  const sites = await listWebsitesWithOwners();
  const plans = PLAN_LIST.map((p) => ({ id: p.id, name: p.name }));

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Admin plans <Badge tone="indigo">Admin</Badge>
          </span>
        }
        description="Put any user's website on any plan. Applying a plan activates the website without payment and queues a fresh audit."
      />
      <Card className="overflow-hidden">
        {sites.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-ink-500">No websites yet.</p>
        ) : (
          <ul className="divide-y divide-ink-100">
            {sites.map((site) => (
              <li key={site.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900">{site.domain}</p>
                  <p className="truncate text-xs text-ink-500">
                    {site.ownerName} · {site.ownerEmail}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    <StatusBadge status={site.status} />
                    {site.subscriptionId && <Badge tone="blue">Paid subscription</Badge>}
                  </div>
                </div>
                <AdminPlanSelect websiteId={site.id} domain={site.domain} currentPlan={site.plan} plans={plans} />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
