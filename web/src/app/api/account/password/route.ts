import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
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
import { hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/server/password";
import { destroyOtherSessions } from "@/lib/server/session";

export const POST = withApi(async (req: Request) => {
  assertSameOrigin(req);
  const user = await requireApiUser();
  const body = await readJsonBody(req);
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword.slice(0, 1000) : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";

  const limit = await rateLimit(`password-change:${user.id}`, 10, 60 * 60);
  if (!limit.ok) throw tooManyRequests(limit.retryAfterSeconds);

  const problem = validatePasswordStrength(newPassword);
  if (problem) throw new HttpError(400, "VALIDATION_ERROR", problem, { field: "newPassword" });

  const db = getDb();
  const [row] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.id, user.id));
  if (!row || !(await verifyPassword(currentPassword, row.passwordHash))) {
    throw new HttpError(400, "INVALID_PASSWORD", "Your current password is incorrect.", { field: "currentPassword" });
  }

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), updatedAt: new Date() })
    .where(eq(users.id, user.id));
  await destroyOtherSessions(user.id, user.sessionId);
  return ok();
});
