import { and, desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense, type ReactNode } from "react";
import { AutoRefresh, PendingPaymentSync } from "@/components/dashboard/auto-refresh";
import {
  CancelPlanButton,
  CheckoutButton,
  ExportLink,
  ManageBillingButton,
  RemoveWebsiteButton,
  RunAuditButton,
} from "@/components/dashboard/website-actions";
import { Card, cn, Notice, ScoreRing, scoreColor, Skeleton, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { audits, websites, type Audit, type Website } from "@/db/schema";
import { CHECKOUT_ALLOWED_STATUSES, isAutomationStatus, isUuid } from "@/lib/constants";
import { formatDateTime, relativeTime } from "@/lib/format";
import { auditIntervalLabel, PLANS } from "@/lib/plans";
import { requireUser } from "@/lib/server/auth";
import { AuditProgress, FixesTab, HistoryTab, IssuesTab, PagesTab, StatusBanner } from "./sections";

export const metadata: Metadata = { title: "Website" };

const TABS = [
  { id: "fixes", label: "Fixes" },
  { id: "issues", label: "Issues" },
  { id: "pages", label: "Pages" },
  { id: "history", label: "History" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function WebsitePage({ params, searchParams }: PageProps<"/dashboard/websites/[id]">) {
  return (
    <Suspense fallback={<WebsiteSkeleton />}>
      <WebsiteView params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function WebsiteSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

function HeaderActions({ site, openAudit, latestCompleted }: { site: Website; openAudit?: Audit; latestCompleted?: Audit }) {
  if (isAutomationStatus(site.status)) {
    return (
      <>
        <RunAuditButton websiteId={site.id} disabled={Boolean(openAudit)} />
        {latestCompleted && <ExportLink auditId={latestCompleted.id} />}
        {!site.cancelAtPeriodEnd && <CancelPlanButton websiteId={site.id} />}
      </>
    );
  }
  if (site.status === "on_hold" || site.status === "paused") return <ManageBillingButton />;
  if (CHECKOUT_ALLOWED_STATUSES.includes(site.status)) {
    return (
      <>
        <CheckoutButton
          websiteId={site.id}
          label={site.status === "cancelled" || site.status === "expired" ? "Resubscribe" : "Complete checkout"}
        />
        <RemoveWebsiteButton websiteId={site.id} />
      </>
    );
  }
  return null;
}

function StatCard({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <div className="mt-2 text-2xl font-bold text-slate-900">{children}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </Card>
  );
}

async function WebsiteView({ params, searchParams }: Pick<PageProps<"/dashboard/websites/[id]">, "params" | "searchParams">) {
  const user = await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // Relative times ("in 6 days") read the clock, so this must render at request time.
  await connection();
  if (!isUuid(id)) notFound();

  const db = getDb();
  const [site] = await db
    .select()
    .from(websites)
    .where(and(eq(websites.id, id), eq(websites.userId, user.id)))
    .limit(1);
  if (!site) notFound();

  const auditList = await db.select().from(audits).where(eq(audits.websiteId, site.id)).orderBy(desc(audits.queuedAt)).limit(30);
  const openAudit = auditList.find((a) => a.status === "queued" || a.status === "running");
  const completed = auditList.filter((a) => a.status === "completed");
  const latestCompleted = completed[0];
  const previousCompleted = completed[1];
  const latestFinished = auditList.find((a) => a.status === "completed" || a.status === "failed");
  const lastFailed = latestFinished?.status === "failed" ? latestFinished : undefined;

  const tab: TabId = TABS.some((t) => t.id === query.tab) ? (query.tab as TabId) : "fixes";
  const plan = PLANS[site.plan];
  const delta =
    latestCompleted?.score !== null && latestCompleted?.score !== undefined && previousCompleted?.score !== null && previousCompleted?.score !== undefined
      ? latestCompleted.score - previousCompleted.score
      : null;

  return (
    <div className="space-y-6">
      {openAudit && <AutoRefresh intervalMs={4000} />}
      {(site.status === "pending_payment" || site.status === "payment_failed") && site.checkoutSessionId && (
        <PendingPaymentSync websiteId={site.id} status={site.status} />
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link href="/dashboard" className="text-sm text-slate-500 hover:text-slate-700">
            ← All websites
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="truncate text-2xl font-bold tracking-tight text-slate-900">{site.domain}</h1>
            <StatusBadge status={site.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            <a href={site.url} target="_blank" rel="noopener noreferrer nofollow" className="hover:text-slate-700">
              {site.url}
            </a>{" "}
            · {plan.name} plan · {auditIntervalLabel(plan.auditIntervalHours)} audits, up to {plan.maxPages.toLocaleString("en-US")} pages
          </p>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <HeaderActions site={site} openAudit={openAudit} latestCompleted={latestCompleted} />
        </div>
      </div>

      <StatusBanner
        site={site}
        checkoutCancelled={typeof query.checkout === "string" && query.checkout.startsWith("cancelled")}
      />
      {openAudit && <AuditProgress audit={openAudit} />}
      {lastFailed && !openAudit && (
        <Notice tone="red" title={`The audit on ${formatDateTime(lastFailed.finishedAt ?? lastFailed.queuedAt)} failed`}>
          {lastFailed.error ?? "Unknown error."} We&apos;ll retry automatically, or you can run an audit now.
        </Notice>
      )}

      {latestCompleted ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card className="flex items-center gap-4 p-5">
              <ScoreRing score={latestCompleted.score} size={72} />
              <div>
                <p className="text-sm text-slate-500">AEO score</p>
                {delta !== null ? (
                  <p className="text-sm font-semibold" style={{ color: delta >= 0 ? scoreColor(100) : scoreColor(0) }}>
                    {delta >= 0 ? `+${delta}` : delta} since last audit
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">First audit</p>
                )}
              </div>
            </Card>
            <StatCard label="Issues found" sub={`${latestCompleted.issuesHigh} high · ${latestCompleted.issuesMedium} medium · ${latestCompleted.issuesLow} low`}>
              {latestCompleted.issuesHigh + latestCompleted.issuesMedium + latestCompleted.issuesLow}
            </StatCard>
            <StatCard label="Pages crawled" sub={`Last audit ${relativeTime(latestCompleted.finishedAt)}`}>
              {latestCompleted.pagesCrawled}
            </StatCard>
            <StatCard
              label="Next automatic audit"
              sub={site.nextAuditAt ? formatDateTime(site.nextAuditAt) : undefined}
            >
              <span className="text-lg">
                {!isAutomationStatus(site.status)
                  ? "Paused"
                  : openAudit
                    ? "Running now"
                    : site.nextAuditAt
                      ? relativeTime(site.nextAuditAt)
                      : "Scheduled"}
              </span>
            </StatCard>
          </div>

          <nav aria-label="Report sections" className="flex gap-1 overflow-x-auto border-b border-slate-200">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={`/dashboard/websites/${site.id}?tab=${t.id}`}
                scroll={false}
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "-mb-px border-b-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition",
                  tab === t.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          <Suspense key={tab} fallback={<Skeleton className="h-96" />}>
            {tab === "fixes" && <FixesTab websiteId={site.id} hasCompletedAudit />}
            {tab === "issues" && <IssuesTab auditId={latestCompleted.id} />}
            {tab === "pages" && <PagesTab auditId={latestCompleted.id} />}
            {tab === "history" && <HistoryTab audits={auditList} />}
          </Suspense>
        </>
      ) : (
        !openAudit &&
        isAutomationStatus(site.status) &&
        !lastFailed && (
          <Card className="p-8 text-center text-sm text-slate-600">
            Your first audit will start in a moment. This page updates automatically.
            <AutoRefresh intervalMs={5000} />
          </Card>
        )
      )}

      {!latestCompleted && auditList.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-slate-900">Audit history</h2>
          <HistoryTab audits={auditList} />
        </section>
      )}
    </div>
  );
}
