import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { audits, websites, type Website } from "@/db/schema";
import { isUuid } from "@/lib/constants";
import { HttpError } from "./api";

/** Loads a website only if it belongs to the given user; otherwise a 404 (never reveal other users' ids). */
export async function getOwnedWebsite(userId: string, websiteId: string): Promise<Website> {
  if (!isUuid(websiteId)) throw new HttpError(404, "NOT_FOUND", "Website not found.");
  const [site] = await getDb()
    .select()
    .from(websites)
    .where(and(eq(websites.id, websiteId), eq(websites.userId, userId)))
    .limit(1);
  if (!site) throw new HttpError(404, "NOT_FOUND", "Website not found.");
  return site;
}

export async function websiteStatusPayload(site: Website) {
  const [latestAudit] = await getDb()
    .select({
      id: audits.id,
      status: audits.status,
      trigger: audits.trigger,
      progress: audits.progress,
      pagesCrawled: audits.pagesCrawled,
      score: audits.score,
      error: audits.error,
      queuedAt: audits.queuedAt,
      startedAt: audits.startedAt,
      finishedAt: audits.finishedAt,
    })
    .from(audits)
    .where(eq(audits.websiteId, site.id))
    .orderBy(desc(audits.queuedAt))
    .limit(1);

  return {
    website: {
      id: site.id,
      url: site.url,
      domain: site.domain,
      plan: site.plan,
      status: site.status,
      latestScore: site.latestScore,
      lastAuditAt: site.lastAuditAt,
      nextAuditAt: site.nextAuditAt,
      nextBillingDate: site.nextBillingDate,
      cancelAtPeriodEnd: site.cancelAtPeriodEnd,
    },
    latestAudit: latestAudit ?? null,
  };
}
