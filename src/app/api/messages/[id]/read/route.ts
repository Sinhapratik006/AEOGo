import { isUuid } from "@/lib/constants";
import { assertSameOrigin, HttpError, ok, requireApiUser, withApi } from "@/lib/server/api";
import { markMessageRead } from "@/lib/server/messages";

export const POST = withApi(async (req: Request, ctx: RouteContext<"/api/messages/[id]/read">) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const { id } = await ctx.params;
  if (!isUuid(id) || !(await markMessageRead(user.id, id))) throw new HttpError(404, "NOT_FOUND", "Message not found.");
  return ok();
});
