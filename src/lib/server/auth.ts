import "server-only";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { getSessionUser, type SessionUser } from "./session";

/**
 * Data Access Layer entry point for Server Components: reads and validates the
 * session once per request. Call it inside a <Suspense> boundary.
 */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => getSessionUser());

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Admin-only pages render a 404 for everyone else, so the area isn't discoverable. */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) notFound();
  return user;
}
