import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { drafts, websites } from "@/db/schema";
import { isUuid, type DraftStatus } from "@/lib/constants";
import { assertSameOrigin, HttpError, ok, readJsonBody, requireApiUser, withApi } from "@/lib/server/api";

const STATUSES: DraftStatus[] = ["draft", "approved", "rejected"];

/** Marks a suggested fix as approved/rejected. Fixes are never published automatically. */
export const PATCH = withApi(async (req: Request, ctx: RouteContext<"/api/drafts/[id]">) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, "NOT_FOUND", "Fix not found.");

  const body = await readJsonBody(req);
  const status = body.status as DraftStatus;
  if (!STATUSES.includes(status)) throw new HttpError(400, "VALIDATION_ERROR", "Invalid status.");

  const db = getDb();
  const [owned] = await db
    .select({ id: drafts.id })
    .from(drafts)
    .innerJoin(websites, eq(websites.id, drafts.websiteId))
    .where(and(eq(drafts.id, id), eq(websites.userId, user.id)))
    .limit(1);
  if (!owned) throw new HttpError(404, "NOT_FOUND", "Fix not found.");

  await db.update(drafts).set({ status, updatedAt: new Date() }).where(eq(drafts.id, id));
  return ok({ status });
});
