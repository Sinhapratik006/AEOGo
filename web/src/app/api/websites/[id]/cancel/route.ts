import { syncSubscription } from "@/lib/billing";
import { LIVE_SUBSCRIPTION_STATUSES } from "@/lib/constants";
import { getDodo } from "@/lib/dodo";
import { assertSameOrigin, HttpError, ok, readJsonBody, requireApiUser, withApi } from "@/lib/server/api";
import { getOwnedWebsite } from "@/lib/server/websites";

/** Cancels at the end of the billing period ({ resume: true } undoes a scheduled cancellation). */
export const POST = withApi(async (req: Request, ctx: RouteContext<"/api/websites/[id]/cancel">) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const site = await getOwnedWebsite(user.id, id);
  if (!site.subscriptionId || !LIVE_SUBSCRIPTION_STATUSES.includes(site.status)) {
    throw new HttpError(409, "NO_ACTIVE_SUBSCRIPTION", "This website doesn't have an active subscription.");
  }

  const body = await readJsonBody(req);
  const resume = body.resume === true;
  const updated = await getDodo().subscriptions.update(site.subscriptionId, {
    cancel_at_next_billing_date: !resume,
  });
  await syncSubscription(updated);
  return ok({ cancelAtPeriodEnd: !resume });
});
