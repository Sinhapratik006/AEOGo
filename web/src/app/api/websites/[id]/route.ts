import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { websites } from "@/db/schema";
import { LIVE_SUBSCRIPTION_STATUSES } from "@/lib/constants";
import { assertSameOrigin, HttpError, ok, requireApiUser, withApi } from "@/lib/server/api";
import { getOwnedWebsite, websiteStatusPayload } from "@/lib/server/websites";

export const GET = withApi(async (_req: Request, ctx: RouteContext<"/api/websites/[id]">) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const site = await getOwnedWebsite(user.id, id);
  return ok(await websiteStatusPayload(site));
});

export const DELETE = withApi(async (req: Request, ctx: RouteContext<"/api/websites/[id]">) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const { id } = await ctx.params;
  const site = await getOwnedWebsite(user.id, id);
  if (LIVE_SUBSCRIPTION_STATUSES.includes(site.status)) {
    throw new HttpError(409, "HAS_ACTIVE_SUBSCRIPTION", "Cancel the subscription before removing this website.");
  }
  await getDb().delete(websites).where(eq(websites.id, site.id));
  return ok();
});
