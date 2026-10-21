import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * Optimistic check only: sends visitors without a session cookie to /login.
 * Real authorization happens in the data layer (requireUser / requireApiUser).
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
