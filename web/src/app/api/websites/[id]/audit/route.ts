import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { audits } from "@/db/schema";
import { enqueueAudit } from "@/lib/audits";
import { isAutomationStatus } from "@/lib/constants";
import { PLANS } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, HttpError, ok, requireApiUser, tooManyRequests, withApi } from "@/lib/server/api";
import { getOwnedWebsite } from "@/lib/server/websites";

/** "Run audit now". Limited per plan. */
export const POST = withApi(async (req: Request, ctx: RouteContext<"/api/websites/[id]/audit">) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const site = await getOwnedWebsite(user.id, id);
  if (!isAutomationStatus(site.status)) {
    throw new HttpError(409, "NOT_ACTIVE", "Audits run once the subscription for this website is active.");
  }

  const db = getDb();
  const [open] = await db
    .select({ id: audits.id })
    .from(audits)
    .where(and(eq(audits.websiteId, site.id), inArray(audits.status, ["queued", "running"])))
    .limit(1);
  if (open) throw new HttpError(409, "AUDIT_IN_PROGRESS", "An audit is already running for this website.");

  const plan = PLANS[site.plan];
  const limit = await rateLimit(`manual-audit:${site.id}`, plan.manualAuditsPerDay, 24 * 60 * 60);
  if (!limit.ok) {
    throw tooManyRequests(
      limit.retryAfterSeconds,
      `Your ${plan.name} plan includes ${plan.manualAuditsPerDay} on-demand audit${plan.manualAuditsPerDay === 1 ? "" : "s"} per day. Automatic audits keep running on schedule.`,
    );
  }

  const auditId = await enqueueAudit(db, site.id, "manual");
  if (!auditId) throw new HttpError(409, "AUDIT_IN_PROGRESS", "An audit is already running for this website.");
  return ok({ auditId }, 202);
});
