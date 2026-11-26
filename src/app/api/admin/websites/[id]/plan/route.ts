import { isPlanId } from "@/lib/plans";
import { setWebsitePlan } from "@/lib/server/admin-plans";
import { assertSameOrigin, HttpError, ok, readJsonBody, requireApiAdmin, withApi } from "@/lib/server/api";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Admin puts any website on any plan (activates it without payment). */
export const POST = withApi(async (req: Request, ctx: RouteContext<"/api/admin/websites/[id]/plan">) => {
  assertSameOrigin(req);
  await requireApiAdmin();
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) throw new HttpError(404, "NOT_FOUND", "Website not found.");

  const body = await readJsonBody(req);
  if (!isPlanId(body.plan)) throw new HttpError(400, "VALIDATION_ERROR", "Choose a valid plan.", { field: "plan" });

  if (!(await setWebsitePlan(id, body.plan))) throw new HttpError(404, "NOT_FOUND", "Website not found.");
  return ok({ plan: body.plan, status: "active" });
});
