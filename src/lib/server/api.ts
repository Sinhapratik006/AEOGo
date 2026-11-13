import "server-only";
import { APIError as DodoAPIError } from "dodopayments";
import { appUrl, ConfigError } from "@/lib/env";
import { getSessionUser, type SessionUser } from "./session";

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const NO_STORE = { "Cache-Control": "no-store" };

export function ok(data: Record<string, unknown> = {}, status = 200): Response {
  return Response.json({ ok: true, ...data }, { status, headers: NO_STORE });
}

export function apiError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): Response {
  return Response.json({ ok: false, error: { code, message, ...extra } }, { status, headers: { ...NO_STORE, ...headers } });
}

/** Wraps a Route Handler so every failure becomes a clean JSON error response. */
export function withApi<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        const headers: Record<string, string> = {};
        if (typeof err.extra.retryAfterSeconds === "number") headers["Retry-After"] = String(err.extra.retryAfterSeconds);
        return apiError(err.status, err.code, err.message, err.extra, headers);
      }
      if (err instanceof ConfigError) {
        console.error("[api] configuration error:", err.message);
        return apiError(503, "NOT_CONFIGURED", `The server is missing configuration: ${err.message}`);
      }
      if (err instanceof DodoAPIError) {
        console.error("[api] Dodo Payments API error", { status: err.status, message: err.message });
        return apiError(502, "PAYMENT_PROVIDER_ERROR", "Our payment provider returned an error. Please try again in a moment.");
      }
      console.error("[api] unhandled error", err);
      return apiError(500, "INTERNAL_ERROR", "Something went wrong. Please try again.");
    }
  };
}

export async function readJsonBody(req: Request, maxBytes = 16_384): Promise<Record<string, unknown>> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > maxBytes) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "PAYLOAD_TOO_LARGE", "Request body is too large.");
  if (!text.trim()) return {};
  try {
    const data: unknown = JSON.parse(text);
    if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  } catch {
    // Fall through to the error below.
  }
  throw new HttpError(400, "INVALID_JSON", "Request body must be a JSON object.");
}

/**
 * CSRF defense in depth (cookies are already SameSite=Lax): mutating requests must
 * come from our own origin when the browser tells us where they come from.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) {
    const fetchSite = req.headers.get("sec-fetch-site");
    if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
      throw new HttpError(403, "FORBIDDEN_ORIGIN", "Cross-site requests are not allowed.");
    }
    return;
  }
  const allowed = new Set<string>([new URL(appUrl()).origin]);
  try {
    allowed.add(new URL(req.url).origin);
  } catch {
    // Ignore unparsable request URLs.
  }
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? new URL(req.url).protocol.replace(":", "");
    allowed.add(`${proto}://${host}`);
  }
  if (!allowed.has(origin)) throw new HttpError(403, "FORBIDDEN_ORIGIN", "Cross-site requests are not allowed.");
}

/**
 * Best-effort client IP for rate limiting. Behind a proxy that sets a trustworthy
 * header (e.g. cf-connecting-ip on Cloudflare, fly-client-ip on Fly.io), set
 * TRUSTED_IP_HEADER to that header name. Email-based limits never depend on this.
 */
export function clientIp(req: Request): string | null {
  const trustedHeader = process.env.TRUSTED_IP_HEADER?.trim().toLowerCase();
  if (trustedHeader) {
    const value = req.headers.get(trustedHeader);
    if (value) return value.split(",")[0].trim().slice(0, 64) || null;
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim().slice(0, 64) || null;
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim().slice(0, 64) || null;
  return null;
}

export async function requireApiUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "UNAUTHORIZED", "Please sign in to continue.");
  return user;
}

export function str(value: unknown, maxLength = 500): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(email: string): boolean {
  return email.length <= 254 && EMAIL_RE.test(email);
}

export function tooManyRequests(retryAfterSeconds: number, message = "Too many attempts. Please try again later."): HttpError {
  return new HttpError(429, "RATE_LIMITED", message, { retryAfterSeconds });
}
