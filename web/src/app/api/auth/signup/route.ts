import { getDb } from "@/db";
import { users } from "@/db/schema";
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
import { hashPassword, validatePasswordStrength } from "@/lib/server/password";
import { createSession } from "@/lib/server/session";

export const POST = withApi(async (req: Request) => {
  assertSameOrigin(req);
  const body = await readJsonBody(req);
  const name = str(body.name, 100);
  const email = str(body.email, 254).toLowerCase();
  const password = typeof body.password === "string" ? body.password : "";

  if (!name) throw new HttpError(400, "VALIDATION_ERROR", "Please enter your name.", { field: "name" });
  if (!isValidEmail(email)) throw new HttpError(400, "VALIDATION_ERROR", "Please enter a valid email address.", { field: "email" });
  const passwordProblem = validatePasswordStrength(password);
  if (passwordProblem) throw new HttpError(400, "VALIDATION_ERROR", passwordProblem, { field: "password" });

  const ip = clientIp(req);
  const limit = await rateLimit(`signup:ip:${ip ?? "unknown"}`, 10, 60 * 60);
  if (!limit.ok) throw tooManyRequests(limit.retryAfterSeconds);
  // Backstop in case client IPs are spoofed or unavailable.
  const global = await rateLimit("signup:global", 300, 60 * 60);
  if (!global.ok) throw tooManyRequests(global.retryAfterSeconds, "We're receiving too many signups right now. Please try again shortly.");

  const passwordHash = await hashPassword(password);
  const [created] = await getDb()
    .insert(users)
    .values({ name, email, passwordHash })
    .onConflictDoNothing({ target: users.email })
    .returning({ id: users.id });
  if (!created) {
    throw new HttpError(409, "EMAIL_TAKEN", "An account with this email already exists. Try signing in instead.", {
      field: "email",
    });
  }

  await createSession(created.id, { ip, userAgent: req.headers.get("user-agent") });
  return ok({}, 201);
});
