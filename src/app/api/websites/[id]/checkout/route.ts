import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { websites } from "@/db/schema";
import { CHECKOUT_ALLOWED_STATUSES } from "@/lib/constants";
import { isPlanId } from "@/lib/plans";
import { rateLimit } from "@/lib/rate-limit";
import {
  assertSameOrigin,
  HttpError,
  ok,
  readJsonBody,
  requireApiUser,
  tooManyRequests,
  withApi,
} from "@/lib/server/api";
import { createCheckoutForWebsite } from "@/lib/server/checkout";
import { getOwnedWebsite } from "@/lib/server/websites";

/** Starts a new checkout for a website that is unpaid, failed, cancelled or expired. */
export const POST = withApi(async (req: Request, ctx: RouteContext<"/api/websites/[id]/checkout">) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const site = await getOwnedWebsite(user.id, id);
  if (!CHECKOUT_ALLOWED_STATUSES.includes(site.status)) {
    throw new HttpError(409, "ALREADY_SUBSCRIBED", "This website already has an active plan.");
  }

  const body = await readJsonBody(req);
  const plan = isPlanId(body.plan) ? body.plan : site.plan;
  const limit = await rateLimit(`checkout:user:${user.id}`, 20, 60 * 60);
  if (!limit.ok) throw tooManyRequests(limit.retryAfterSeconds);

  if (plan !== site.plan) {
    await getDb().update(websites).set({ plan, updatedAt: new Date() }).where(eq(websites.id, site.id));
  }
  const checkoutUrl = await createCheckoutForWebsite(user, site, plan);
  return ok({ checkoutUrl });
});
