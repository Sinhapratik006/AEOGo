import { eq } from "drizzle-orm";
import { after } from "next/server";
import { getDb } from "@/db";
import { passwordResetTokens, users } from "@/db/schema";
import { passwordResetEmail, sendEmailSafely } from "@/lib/email";
import { appUrl } from "@/lib/env";
import { rateLimit } from "@/lib/rate-limit";
import {
  assertSameOrigin,
  clientIp,
  HttpError,
  isValidEmail,
  ok,
  readJsonBody,
  str,
  tooManyRequests,
  withApi,
} from "@/lib/server/api";
import { hashToken, newToken } from "@/lib/server/session";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export const POST = withApi(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJsonBody(req);
  const email = str(body.email, 254).toLowerCase();
  if (!isValidEmail(email)) throw new HttpError(400, "VALIDATION_ERROR", "Please enter a valid email address.");

  const byIp = await rateLimit(`forgot:ip:${clientIp(req) ?? "unknown"}`, 10, 60 * 60);
  if (!byIp.ok) throw tooManyRequests(byIp.retryAfterSeconds);
  // Backstop against using us to email-bomb many addresses, even with spoofed IPs.
  const global = await rateLimit("forgot:global", 200, 60 * 60);
  if (!global.ok) throw tooManyRequests(global.retryAfterSeconds);
  const byEmail = await rateLimit(`forgot:email:${email}`, 3, 60 * 60);

  const [user] = await getDb()
    .select({ id: users.id, email: users.email, name: users.name })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (user && byEmail.ok) {
    const token = newToken();
    await getDb()
      .insert(passwordResetTokens)
      .values({ id: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) });
    const resetUrl = `${appUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    // Sent after the response so timing doesn't reveal whether the account exists.
    after(() => sendEmailSafely(passwordResetEmail(user.email, user.name, resetUrl)));
  }

  // Same response either way, so this endpoint can't be used to discover accounts.
  return ok({ message: "If an account exists for that email, we've sent a password reset link." });
});
