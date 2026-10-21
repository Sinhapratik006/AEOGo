import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { assertSameOrigin, HttpError, ok, readJsonBody, requireApiUser, str, withApi } from "@/lib/server/api";

export const PATCH = withApi(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const body = await readJsonBody(req);
  const name = str(body.name, 100);
  if (!name) throw new HttpError(400, "VALIDATION_ERROR", "Please enter your name.", { field: "name" });
  await getDb().update(users).set({ name, updatedAt: new Date() }).where(eq(users.id, user.id));
  return ok({ name });
});
