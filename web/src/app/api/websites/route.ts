import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { websites } from "@/db/schema";
import { LIVE_SUBSCRIPTION_STATUSES } from "@/lib/constants";
import { productIdForPlan } from "@/lib/dodo";
import { ConfigError } from "@/lib/env";
import { checkPublicHostname, safeFetch } from "@/lib/net/safe-fetch";
import { isPlanId } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import {
  assertSameOrigin,
  HttpError,
  ok,
  readJsonBody,
  requireApiUser,
  str,
  tooManyRequests,
  withApi,
} from "@/lib/server/api";
import { createCheckoutForWebsite } from "@/lib/server/checkout";
import { normalizeWebsiteUrl } from "@/lib/url";

export const GET = withApi(async () => {
  const user = await requireApiUser();
  const rows = await getDb()
    .select({
      id: websites.id,
      url: websites.url,
      domain: websites.domain,
      plan: websites.plan,
      status: websites.status,
      latestScore: websites.latestScore,
      lastAuditAt: websites.lastAuditAt,
      nextAuditAt: websites.nextAuditAt,
      cancelAtPeriodEnd: websites.cancelAtPeriodEnd,
    })
    .from(websites)
    .where(eq(websites.userId, user.id))
    .orderBy(desc(websites.createdAt));
  return ok({ websites: rows });
});

async function reachabilityProblem(url: string): Promise<string | null> {
  try {
    const res = await safeFetch(`${url}/`, { timeoutMs: 10_000, maxBytes: 256 * 1024 });
    return res.status >= 500 ? `the server responded with HTTP ${res.status}` : null;
  } catch (err) {
    return (err as Error).message;
  }
}

/** Adds a website (or reuses the customer's existing entry for it) and starts a Dodo checkout. */
export const POST = withApi(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const body = await readJsonBody(req);

  const plan = body.plan;
  if (!isPlanId(plan)) throw new HttpError(400, "VALIDATION_ERROR", "Choose a plan.", { field: "plan" });
  const normalized = normalizeWebsiteUrl(str(body.url, 2048));
  if (!normalized.ok) throw new HttpError(400, "VALIDATION_ERROR", normalized.error, { field: "url" });
  if (!productIdForPlan(plan)) throw new ConfigError(`DODO_PRODUCT_ID_${plan.toUpperCase()} is not set`);

  const limit = await rateLimit(`checkout:user:${user.id}`, 20, 60 * 60);
  if (!limit.ok) throw tooManyRequests(limit.retryAfterSeconds);

  const host = await checkPublicHostname(normalized.domain);
  if (!host.ok) {
    throw host.reason === "not_found"
      ? new HttpError(422, "DOMAIN_NOT_FOUND", `We couldn't find ${normalized.domain}. Check the spelling and try again.`, {
          field: "url",
        })
      : new HttpError(422, "DOMAIN_NOT_ALLOWED", `${normalized.domain} doesn't point to a public website.`, { field: "url" });
  }
  if (body.skipReachabilityCheck !== true) {
    const problem = await reachabilityProblem(normalized.url);
    if (problem) {
      throw new HttpError(
        422,
        "UNREACHABLE",
        `We couldn't load ${normalized.url} (${problem}). If your site is online, you can continue anyway.`,
        { field: "url" },
      );
    }
  }

  const db = getDb();
  const [site] = await db
    .insert(websites)
    .values({ userId: user.id, url: normalized.url, domain: normalized.domain, plan, status: "pending_payment" })
    .onConflictDoUpdate({ target: [websites.userId, websites.url], set: { updatedAt: new Date() } })
    .returning();
  if (LIVE_SUBSCRIPTION_STATUSES.includes(site.status)) {
    throw new HttpError(409, "ALREADY_SUBSCRIBED", `${site.domain} already has an active plan.`, { websiteId: site.id });
  }
  if (site.plan !== plan) {
    await db.update(websites).set({ plan, updatedAt: new Date() }).where(eq(websites.id, site.id));
  }

  const checkoutUrl = await createCheckoutForWebsite(user, site, plan);
  return ok({ websiteId: site.id, checkoutUrl }, 201);
});
