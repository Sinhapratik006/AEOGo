import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { assertSameOrigin, HttpError, ok, requireApiUser, withApi } from "@/lib/server/api";

export const POST = withApi(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  // Only let users with a password disconnect Google, so they don't lock
  // themselves out of their account.
  const [row] = await getDb()
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, user.id))
    .limit(1);
  if (!row || !row.passwordHash) {
    throw new HttpError(400, "VALIDATION_ERROR", "Set a password before disconnecting Google.");
  }
  await getDb()
    .update(users)
    .set({ googleId: null, updatedAt: new Date() })
    .where(eq(users.id, user.id));
  return ok();
});
