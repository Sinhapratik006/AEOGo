import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { passwordResetTokens, sessions, users } from "@/db/schema";
import { rateLimit } from "@/lib/rate-limit";
import {
  assertSameOrigin,
  clientIp,
  HttpError,
  ok,
  readJsonBody,
  str,
  tooManyRequests,
  withApi,
} from "@/lib/server/api";
import { hashPassword, validatePasswordStrength } from "@/lib/server/password";
import { createSession, hashToken } from "@/lib/server/session";

export const POST = withApi(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJsonBody(req);
  const token = str(body.token, 200);
  const password = typeof body.password === "string" ? body.password : "";
  if (!token) throw new HttpError(400, "INVALID_TOKEN", "This reset link is invalid or has expired.");
  const passwordProblem = validatePasswordStrength(password);
  if (passwordProblem) throw new HttpError(400, "VALIDATION_ERROR", passwordProblem, { field: "password" });

  const ip = clientIp(req);
  const limit = await rateLimit(`reset:ip:${ip ?? "unknown"}`, 20, 60 * 60);
  if (!limit.ok) throw tooManyRequests(limit.retryAfterSeconds);

  const passwordHash = await hashPassword(password);
  const userId = await getDb().transaction(async (tx) => {
    const now = new Date();
    const [row] = await tx
      .select({ id: passwordResetTokens.id, userId: passwordResetTokens.userId })
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.id, hashToken(token)),
          isNull(passwordResetTokens.usedAt),
          gt(passwordResetTokens.expiresAt, now),
        ),
      )
      .for("update");
    if (!row) return null;
    await tx.update(users).set({ passwordHash, updatedAt: now }).where(eq(users.id, row.userId));
    // Burn this and every other outstanding reset link, and sign out everywhere.
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(eq(passwordResetTokens.userId, row.userId), isNull(passwordResetTokens.usedAt)));
    await tx.delete(sessions).where(eq(sessions.userId, row.userId));
    return row.userId;
  });
  if (!userId) throw new HttpError(400, "INVALID_TOKEN", "This reset link is invalid or has expired. Request a new one.");

  await createSession(userId, { ip, userAgent: req.headers.get("user-agent") });
  return ok();
});
