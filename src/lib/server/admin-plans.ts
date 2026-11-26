import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users, websites } from "@/db/schema";
import { enqueueAudit } from "@/lib/audits";
import type { PlanId } from "@/lib/constants";

/** Every website with its owner, for the admin plan manager. */
export async function listWebsitesWithOwners() {
  return getDb()
    .select({
      id: websites.id,
      domain: websites.domain,
      plan: websites.plan,
      status: websites.status,
      subscriptionId: websites.subscriptionId,
      ownerEmail: users.email,
      ownerName: users.name,
    })
    .from(websites)
    .innerJoin(users, eq(users.id, websites.userId))
    .orderBy(asc(users.email), asc(websites.domain));
}

/**
 * Admin override: puts a website on any plan and activates it without payment,
 * then queues a fresh audit so the new plan's limits apply right away.
 * Returns false when the website doesn't exist.
 */
export async function setWebsitePlan(websiteId: string, plan: PlanId): Promise<boolean> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const [site] = await tx
      .update(websites)
      .set({ plan, status: "active", activatedAt: now, nextAuditAt: now, updatedAt: now })
      .where(eq(websites.id, websiteId))
      .returning({ id: websites.id });
    if (!site) return false;
    await enqueueAudit(tx, site.id, "manual");
    return true;
  });
}
