import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireEnv, isHttpsApp } from "@/lib/env";
import { newCodeVerifier, googleAuthUrl } from "@/lib/server/google";

const OAUTH_COOKIE_MAX_AGE = 600; // 10 minutes
const COOKIE_OPTS = {
  httpOnly: true,
  secure: isHttpsApp(),
  sameSite: "lax" as const,
  path: "/",
  maxAge: OAUTH_COOKIE_MAX_AGE,
} as const;

export async function GET(req: Request): Promise<Response> {
  // Google OAuth is optional: fail gracefully with a clear message if not configured.
  let clientId: string;
  let clientSecret: string;
  try {
    clientId = requireEnv("GOOGLE_CLIENT_ID");
    clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: "NOT_CONFIGURED", message: "Google sign-in is not configured on this server." } },
      { status: 503 },
    );
  }
  void clientId;
  void clientSecret;

  const url = new URL(req.url);
  const next = url.searchParams.get("next") ?? null;
  const connect = url.searchParams.get("connect") === "1";

  const state = randomBytes(32).toString("base64url");
  const codeVerifier = newCodeVerifier();

  const cookieStore = await cookies();
  cookieStore.set("google_oauth_state", state, COOKIE_OPTS);
  cookieStore.set("google_oauth_code_verifier", codeVerifier, COOKIE_OPTS);
  if (next) cookieStore.set("google_oauth_next", next, COOKIE_OPTS);
  if (connect) cookieStore.set("google_oauth_connect", "1", COOKIE_OPTS);

  return NextResponse.redirect(googleAuthUrl({ state, codeVerifier, next }).toString(), 302);
}
