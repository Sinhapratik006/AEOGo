import { and, desc, eq, inArray } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, ScoreRing, Skeleton, StatusBadge } from "@/components/ui";
import { getDb } from "@/db";
import { audits, websites } from "@/db/schema";
import { isAutomationStatus } from "@/lib/constants";
import { relativeTime } from "@/lib/format";
import { PLANS } from "@/lib/plans";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Websites" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Your websites"
        description="Every website runs on its own plan. Audits and fixes update automatically."
        actions={<ButtonLink href="/dashboard/websites/new">Add website</ButtonLink>}
      />
      <Suspense fallback={<WebsiteListSkeleton />}>
        <WebsiteList />
      </Suspense>
    </>
  );
}

function WebsiteListSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {[0, 1].map((i) => (
        <Skeleton key={i} className="h-36" />
      ))}
    </div>
  );
}

async function WebsiteList() {
  const user = await requireUser();
  // Relative times ("2 hours ago") read the clock, so this must render at request time.
  await connection();
  const db = getDb();
  const sites = await db.select().from(websites).where(eq(websites.userId, user.id)).orderBy(desc(websites.createdAt));

  if (sites.length === 0) {
    return (
      <EmptyState
        title="Add your first website"
        description="Choose a plan, enter your website address, and our automation will audit it for AI answer engines and write the fixes for you."
        action={<ButtonLink href="/dashboard/websites/new">Add a website</ButtonLink>}
      />
    );
  }

  const open = await db
    .select({ websiteId: audits.websiteId, status: audits.status, progress: audits.progress })
    .from(audits)
    .where(and(inArray(audits.websiteId, sites.map((s) => s.id)), inArray(audits.status, ["queued", "running"])));
  const openBySite = new Map(open.map((a) => [a.websiteId, a]));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {sites.map((site) => {
        const running = openBySite.get(site.id);
        return (
          <Link key={site.id} href={`/dashboard/websites/${site.id}`} className="group">
            <Card className="flex h-full items-start gap-5 p-5 transition group-hover:border-indigo-300 group-hover:shadow-md">
              <ScoreRing score={site.latestScore} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate font-semibold text-slate-900">{site.domain}</h2>
                  <StatusBadge status={site.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">{PLANS[site.plan]?.name ?? site.plan} plan</p>
                <div className="mt-3 text-sm text-slate-600">
                  {running ? (
                    <Badge tone="indigo">{running.status === "running" ? running.progress ?? "Audit running" : "Audit queued"}</Badge>
                  ) : site.status === "pending_payment" || site.status === "payment_failed" ? (
                    <span className="font-medium text-indigo-600">Complete checkout to start →</span>
                  ) : isAutomationStatus(site.status) ? (
                    <span>
                      {site.lastAuditAt ? `Last audit ${relativeTime(site.lastAuditAt)}` : "First audit pending"}
                      {site.nextAuditAt && ` · next ${relativeTime(site.nextAuditAt)}`}
                    </span>
                  ) : (
                    <span>Automation stopped</span>
                  )}
                </div>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
