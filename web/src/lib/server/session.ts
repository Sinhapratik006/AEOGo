import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt, ne, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/constants";
import { isHttpsApp } from "@/lib/env";

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  dodoCustomerId: string | null;
  sessionId: string;
}

/** Only the SHA-256 of a session token is stored, so a database leak can't be replayed. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function newToken(): string {
  return randomBytes(32).toString("base64url");
}

async function readSessionToken(): Promise<string | null> {
  const value = (await cookies()).get(SESSION_COOKIE)?.value;
  return value && value.length <= 128 ? value : null;
}

/** Creates a session and sets the cookie. Only callable from Route Handlers / Server Functions. */
export async function createSession(userId: string, meta: { ip: string | null; userAgent: string | null }): Promise<void> {
  const db = getDb();
  const cookieStore = await cookies();
  // Drop any session this browser already had (prevents session fixation).
  const previous = cookieStore.get(SESSION_COOKIE)?.value;
  if (previous) await db.delete(sessions).where(eq(sessions.id, hashToken(previous)));

  const token = newToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(sessions).values({
    id: hashToken(token),
    userId,
    expiresAt,
    ip: meta.ip,
    userAgent: meta.userAgent ? meta.userAgent.slice(0, 512) : null,
  });
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: isHttpsApp(),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = await readSessionToken();
  if (!token) return null;
  const [row] = await getDb()
    .select({
      sessionId: sessions.id,
      id: users.id,
      email: users.email,
      name: users.name,
      dodoCustomerId: users.dodoCustomerId,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    // Compare against the database clock: reading the JS clock during render isn't allowed with Cache Components.
    .where(and(eq(sessions.id, hashToken(token)), gt(sessions.expiresAt, sql`now()`)))
    .limit(1);
  return row ?? null;
}

export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) await getDb().delete(sessions).where(eq(sessions.id, hashToken(token)));
  cookieStore.delete(SESSION_COOKIE);
}

export async function destroyOtherSessions(userId: string, keepSessionId: string): Promise<void> {
  await getDb()
    .delete(sessions)
    .where(and(eq(sessions.userId, userId), ne(sessions.id, keepSessionId)));
}

export async function destroyAllSessions(userId: string): Promise<void> {
  await getDb().delete(sessions).where(eq(sessions.userId, userId));
}
