import { notifyAfterSync, syncWebsiteFromCheckout } from "@/lib/billing";
import { CHECKOUT_ALLOWED_STATUSES } from "@/lib/constants";
import { ConfigError } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import { assertSameOrigin, ok, requireApiUser, withApi } from "@/lib/server/api";
import { getOwnedWebsite, websiteStatusPayload } from "@/lib/server/websites";

/**
 * Called by the post-checkout page. Verifies the payment directly with Dodo so the
 * subscription activates even if the webhook is slow or not configured yet.
 */
export const POST = withApi(async (req: Request, ctx: RouteContext<"/api/websites/[id]/sync">) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const { id } = await ctx.params;
  let site = await getOwnedWebsite(user.id, id);

  if (CHECKOUT_ALLOWED_STATUSES.includes(site.status)) {
    const limit = await rateLimit(`sync:${site.id}`, 30, 60);
    if (limit.ok) {
      try {
        const result = await syncWebsiteFromCheckout(site.id);
        await notifyAfterSync(result);
      } catch (err) {
        if (err instanceof ConfigError) throw err;
        console.warn("[sync] could not verify the checkout with Dodo yet", (err as Error).message);
      }
      site = await getOwnedWebsite(user.id, id);
    }
  }
  return ok(await websiteStatusPayload(site));
});
