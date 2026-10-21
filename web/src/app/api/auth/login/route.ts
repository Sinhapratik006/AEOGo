import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
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
import { verifyAgainstDummyHash, verifyPassword } from "@/lib/server/password";
import { createSession } from "@/lib/server/session";

export const POST = withApi(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJsonBody(req);
  const email = str(body.email, 254).toLowerCase();
  const password = typeof body.password === "string" ? body.password.slice(0, 1000) : "";
  if (!email || !password) throw new HttpError(400, "VALIDATION_ERROR", "Enter your email and password.");

  const ip = clientIp(req);
  const byIp = await rateLimit(`login:ip:${ip ?? "unknown"}`, 30, 15 * 60);
  if (!byIp.ok) throw tooManyRequests(byIp.retryAfterSeconds);
  const byEmail = await rateLimit(`login:email:${email}`, 10, 15 * 60);
  if (!byEmail.ok) throw tooManyRequests(byEmail.retryAfterSeconds, "Too many sign-in attempts for this account. Try again later.");

  const [user] = await getDb()
    .select({ id: users.id, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  const valid = user ? await verifyPassword(password, user.passwordHash) : await verifyAgainstDummyHash(password);
  if (!user || !valid) throw new HttpError(401, "INVALID_CREDENTIALS", "Incorrect email or password.");

  await createSession(user.id, { ip, userAgent: req.headers.get("user-agent") });
  return ok();
});
