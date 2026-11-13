import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { requireEnv } from "@/lib/env";
import { appUrl } from "@/lib/env";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

/** Scopes: who the user is + their email address. No offline access needed. */
const SCOPES = ["openid", "email", "profile"];

function requireGoogleConfig() {
  return {
    clientId: requireEnv("GOOGLE_CLIENT_ID"),
    clientSecret: requireEnv("GOOGLE_CLIENT_SECRET"),
  };
}

/** Code verifier for PKCE (43-128 chars, base64url without padding). */
export function newCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 code challenge derived from the verifier, per RFC 7636. */
export function codeChallenge(verifier: string): string {
  const digest = createHash("sha256").update(verifier).digest();
  return Buffer.from(digest).toString("base64url");
}

/**
 * Builds Google's authorization URL. The caller must store `state` and
 * `codeVerifier` (tied to this browser session) and verify them on callback.
 */
export function googleAuthUrl({
  state,
  codeVerifier,
  next,
}: {
  state: string;
  codeVerifier: string;
  next: string | null;
}): URL {
  const { clientId } = requireGoogleConfig();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${appUrl()}/api/auth/google/callback`,
    response_type: "code",
    scope: SCOPES.join(" "),
    state,
    code_challenge: codeChallenge(codeVerifier),
    code_challenge_method: "S256",
    // Ask Google to return an ID token too, and force account selection so a
    // signed-in Google user isn't silently re-linked to the wrong AEOGo account.
    access_type: "online",
    prompt: "select_account",
  });
  if (next) params.set("next", next);
  return new URL(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}

interface GoogleTokens {
  access_token: string;
  id_token?: string;
  expires_in?: number;
}

/** Exchanges the authorization code for an access token. */
export async function exchangeGoogleCode(
  code: string,
  codeVerifier: string,
): Promise<GoogleTokens> {
  const { clientId, clientSecret } = requireGoogleConfig();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${appUrl()}/api/auth/google/callback`,
      grant_type: "authorization_code",
      code_verifier: codeVerifier,
    }).toString(),
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const msg =
      typeof body.error_description === "string"
        ? body.error_description
        : typeof body.error === "string"
          ? body.error
          : `Token exchange failed (${res.status})`;
    throw new Error(msg);
  }
  return body as unknown as GoogleTokens;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  name: string;
  verified_email: boolean;
  picture?: string;
}

/** Fetches the authenticated Google user's profile. */
export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const body = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    let msg = `Failed to fetch Google profile (${res.status})`;
    const rawError = body.error;
    if (rawError !== null && typeof rawError === "object") {
      const message = (rawError as { message?: unknown }).message;
      if (typeof message === "string") msg = message;
    }
    throw new Error(msg);
  }
  return {
    id: String(body.id ?? ""),
    email: String(body.email ?? ""),
    name: String(body.name ?? ""),
    verified_email: Boolean(body.verified_email),
    picture: typeof body.picture === "string" ? body.picture : undefined,
  };
}
