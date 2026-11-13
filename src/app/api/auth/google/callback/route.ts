import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { safeNextPath } from "@/lib/url";
import { clientIp } from "@/lib/server/api";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, getSessionUser } from "@/lib/server/session";
import {
  exchangeGoogleCode,
  fetchGoogleUserInfo,
} from "@/lib/server/google";

const COOKIE_OPTS = {
  httpOnly: true,
  path: "/",
  sameSite: "lax" as const,
} as const;

type CookieStore = Awaited<ReturnType<typeof cookies>>;

function clearOAuthCookies(cookieStore: CookieStore): void {
  cookieStore.set("google_oauth_state", "", { ...COOKIE_OPTS, maxAge: 0 });
  cookieStore.set("google_oauth_code_verifier", "", { ...COOKIE_OPTS, maxAge: 0 });
  cookieStore.set("google_oauth_next", "", { ...COOKIE_OPTS, maxAge: 0 });
  cookieStore.set("google_oauth_connect", "", { ...COOKIE_OPTS, maxAge: 0 });
}

function loginError(message: string, next: string | null, req: Request): NextResponse {
  const params = new URLSearchParams({ error: message });
  if (next) params.set("next", next);
  return NextResponse.redirect(new URL(`/login?${params.toString()}`, req.url).toString(), 302);
}

/**
 * Handles Google's OAuth callback. Every failure path redirects back to
 * /login with an error message so the user is never left stranded on the
 * callback URL.
 */
export async function GET(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  if (error) {
    // User cancelled or Google returned an error (e.g. access_denied).
    return loginError("Google sign-in was cancelled. Please try again.", url.searchParams.get("next") ?? null, req);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const connect = url.searchParams.get("connect") === "1";
  if (!code || !state) {
    return loginError("Invalid Google sign-in response.", null, req);
  }

  try {
    return await handleCallback(req, url, code, state, connect);
  } catch {
    // Last resort: never leave the user stuck on the callback URL.
    const cookieStore = await cookies();
    clearOAuthCookies(cookieStore);
    return loginError("Google sign-in failed. Please try again.", null, req);
  }
}

async function handleCallback(
  req: Request,
  url: URL,
  code: string,
  state: string,
  connect: boolean,
): Promise<Response> {
  const cookieStore = await cookies();
  const savedState = cookieStore.get("google_oauth_state")?.value ?? "";
  const codeVerifier = cookieStore.get("google_oauth_code_verifier")?.value ?? "";
  const next = safeNextPath(cookieStore.get("google_oauth_next")?.value ?? null);
  const doConnect = connect || cookieStore.get("google_oauth_connect")?.value === "1";

  // CSRF protection: the state must match the one we stored in the cookie.
  if (!savedState || !codeVerifier || savedState !== state) {
    clearOAuthCookies(cookieStore);
    return loginError("Google sign-in state expired. Please try again.", next, req);
  }

  let googleUser: { id: string; email: string; name: string; verified_email: boolean };
  try {
    const tokens = await exchangeGoogleCode(code, codeVerifier);
    googleUser = await fetchGoogleUserInfo(tokens.access_token);
  } catch {
    clearOAuthCookies(cookieStore);
    return loginError("Google sign-in failed. Please try again.", next, req);
  }

  if (!googleUser.email || !googleUser.verified_email) {
    clearOAuthCookies(cookieStore);
    return loginError("We couldn't verify your Google email address.", next, req);
  }

  const db = getDb();

  if (doConnect) {
    // Link this Google account to the currently signed-in user.
    const sessionUser = await getSessionUser();
    if (!sessionUser) {
      clearOAuthCookies(cookieStore);
      return loginError("Please sign in to your AEOGo account before connecting Google.", next, req);
    }
    // Only link when the Google account's email matches the AEOGo account's
    // email, so a signed-in user can't attach someone else's Google account.
    if (googleUser.email.toLowerCase() !== sessionUser.email.toLowerCase()) {
      clearOAuthCookies(cookieStore);
      return loginError(
        "This Google account is registered to a different email address than your AEOGo account.",
        next,
        req,
      );
    }
    const byGoogle = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.googleId, googleUser.id))
      .limit(1);
    if (byGoogle[0] && byGoogle[0].id !== sessionUser.id) {
      clearOAuthCookies(cookieStore);
      return loginError(
        "This Google account is already connected to another AEOGo account.",
        next,
        req,
      );
    }
    await db
      .update(users)
      .set({ googleId: googleUser.id, updatedAt: new Date() })
      .where(eq(users.id, sessionUser.id));
    clearOAuthCookies(cookieStore);
    return NextResponse.redirect(new URL(next ?? "/dashboard/settings", req.url).toString(), 302);
  }

  // Sign-in / sign-up flow.
  let userId: string;

  // 1. Link by Google id.
  const byGoogle = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.googleId, googleUser.id))
    .limit(1);
  if (byGoogle[0]) {
    userId = byGoogle[0].id;
  } else {
    // 2. Link by email (account exists with email + password).
    const byEmail = await db
      .select({ id: users.id, googleId: users.googleId })
      .from(users)
      .where(eq(users.email, googleUser.email.toLowerCase()))
      .limit(1);
    if (byEmail[0]) {
      if (byEmail[0].googleId && byEmail[0].googleId !== googleUser.id) {
        clearOAuthCookies(cookieStore);
        return loginError(
          "This email is already linked to a different Google account. Sign in with your password instead.",
          next,
          req,
        );
      }
      await db
        .update(users)
        .set({ googleId: googleUser.id, updatedAt: new Date() })
        .where(eq(users.id, byEmail[0].id));
      userId = byEmail[0].id;
    } else {
      // 3. Create a new account from the Google profile.
      const [created] = await db
        .insert(users)
        .values({
          email: googleUser.email.toLowerCase(),
          name: googleUser.name || googleUser.email,
          googleId: googleUser.id,
        })
        .returning({ id: users.id });
      if (!created) {
        clearOAuthCookies(cookieStore);
        return loginError("Could not create your account. Please try again.", next, req);
      }
      userId = created.id;
    }
  }

  await createSession(userId, {
    ip: clientIp(req),
    userAgent: req.headers.get("user-agent"),
  });

  clearOAuthCookies(cookieStore);
  return NextResponse.redirect(new URL(next ?? "/dashboard", req.url).toString(), 302);
}
