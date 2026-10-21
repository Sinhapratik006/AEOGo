import { assertSameOrigin, ok, withApi } from "@/lib/server/api";
import { destroyCurrentSession } from "@/lib/server/session";

export const POST = withApi(async (req: Request) => {
  assertSameOrigin(req);
  await destroyCurrentSession();
  return ok();
});
