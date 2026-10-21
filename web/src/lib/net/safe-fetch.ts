import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import type { Readable } from "node:stream";
import zlib from "node:zlib";
import { appUrl } from "../env";
import { isBlockedHostname, isPublicIp } from "./ip";

/**
 * SSRF-safe HTTP client used for everything that fetches customer-supplied URLs.
 *
 * - Only http/https on default ports, no credentials in URLs.
 * - Every connection resolves DNS through `publicOnlyLookup`, which rejects any
 *   non-public address at connect time (this also defeats DNS rebinding).
 * - Redirects are followed manually and each hop is re-validated.
 * - Bodies are decompressed and capped (truncated) at `maxBytes`.
 */

export type SafeFetchErrorCode =
  | "INVALID_URL"
  | "BLOCKED_HOST"
  | "DNS"
  | "TIMEOUT"
  | "TOO_MANY_REDIRECTS"
  | "TLS"
  | "NETWORK";

export class SafeFetchError extends Error {
  readonly code: SafeFetchErrorCode;
  constructor(code: SafeFetchErrorCode, message: string) {
    super(message);
    this.name = "SafeFetchError";
    this.code = code;
  }
}

export interface SafeFetchOptions {
  /** Total time allowed per request hop. */
  timeoutMs?: number;
  /** Maximum number of decoded body bytes kept; larger bodies are truncated. */
  maxBytes?: number;
  maxRedirects?: number;
  userAgent?: string;
  accept?: string;
}

export interface SafeResponse {
  /** Final URL after redirects. */
  url: string;
  status: number;
  headers: Record<string, string>;
  /** Lower-cased media type without parameters, e.g. "text/html". */
  contentType: string;
  /** Decompressed body bytes (possibly truncated). */
  body: Buffer;
  truncated: boolean;
  /** URLs that redirected, in order, before reaching `url`. */
  redirects: string[];
  text(): string;
}

const ALLOWED_PORTS = new Set(["", "80", "443"]);

export function crawlerUserAgent(): string {
  return `Mozilla/5.0 (compatible; AEOGoBot/1.0; +${appUrl()}/bot)`;
}

export function assertFetchableUrl(input: string | URL): URL {
  let url: URL;
  try {
    url = new URL(input.toString());
  } catch {
    throw new SafeFetchError("INVALID_URL", `Invalid URL: ${String(input).slice(0, 200)}`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SafeFetchError("INVALID_URL", "Only http and https URLs can be fetched");
  }
  if (url.username || url.password) {
    throw new SafeFetchError("INVALID_URL", "URLs containing credentials are not allowed");
  }
  if (!ALLOWED_PORTS.has(url.port)) {
    throw new SafeFetchError("BLOCKED_HOST", "Only the default HTTP and HTTPS ports are allowed");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (net.isIP(host)) {
    // Node skips the custom lookup for IP literals, so they must be checked here.
    if (!isPublicIp(host)) {
      throw new SafeFetchError("BLOCKED_HOST", `Refusing to fetch non-public address ${host}`);
    }
  } else if (isBlockedHostname(host)) {
    throw new SafeFetchError("BLOCKED_HOST", `Refusing to fetch internal hostname ${host}`);
  }
  return url;
}

function blockedError(message: string): NodeJS.ErrnoException {
  const err: NodeJS.ErrnoException = new Error(message);
  err.code = "EBLOCKED";
  return err;
}

const publicOnlyLookup: net.LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) {
      callback(err, "");
      return;
    }
    if (addresses.length === 0) {
      callback(blockedError(`No addresses found for ${hostname}`), "");
      return;
    }
    const blocked = addresses.find((a) => !isPublicIp(a.address));
    if (blocked) {
      callback(blockedError(`${hostname} resolves to non-public address ${blocked.address}`), "");
      return;
    }
    if (options.all) {
      callback(null, addresses);
    } else {
      callback(null, addresses[0].address, addresses[0].family);
    }
  });
};

/** Resolves a hostname and checks that every address is publicly routable. */
export async function checkPublicHostname(
  hostname: string,
): Promise<{ ok: true } | { ok: false; reason: "not_found" | "blocked" }> {
  if (net.isIP(hostname)) return isPublicIp(hostname) ? { ok: true } : { ok: false, reason: "blocked" };
  if (isBlockedHostname(hostname)) return { ok: false, reason: "blocked" };
  try {
    const addresses = await dns.promises.lookup(hostname, { all: true });
    if (addresses.length === 0) return { ok: false, reason: "not_found" };
    if (addresses.some((a) => !isPublicIp(a.address))) return { ok: false, reason: "blocked" };
    return { ok: true };
  } catch {
    return { ok: false, reason: "not_found" };
  }
}

function toSafeError(err: unknown): SafeFetchError {
  if (err instanceof SafeFetchError) return err;
  const e = err as NodeJS.ErrnoException | undefined;
  const code = String(e?.code ?? "");
  const message = e?.message || String(err);
  if (code === "EBLOCKED") return new SafeFetchError("BLOCKED_HOST", message);
  if (code === "ENOTFOUND" || code === "EAI_AGAIN" || code === "ENODATA" || code === "EAI_FAIL") {
    return new SafeFetchError("DNS", `Could not resolve host (${code})`);
  }
  if (code === "ETIMEDOUT" || code === "ESOCKETTIMEDOUT") {
    return new SafeFetchError("TIMEOUT", "Connection timed out");
  }
  if (code.includes("CERT") || code.startsWith("ERR_TLS") || code.startsWith("ERR_SSL") || code.includes("SIGNATURE")) {
    return new SafeFetchError("TLS", `TLS/certificate error (${code})`);
  }
  return new SafeFetchError("NETWORK", code ? `${message} (${code})` : message);
}

interface HopResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  location?: string;
  body: Buffer;
  truncated: boolean;
}

function requestOnce(url: URL, opts: Required<SafeFetchOptions>): Promise<HopResult> {
  return new Promise<HopResult>((resolve, reject) => {
    let settled = false;
    const settle = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn();
    };

    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request(
      url,
      {
        method: "GET",
        headers: {
          "user-agent": opts.userAgent,
          accept: opts.accept,
          "accept-encoding": "gzip, deflate, br",
          "accept-language": "en-US,en;q=0.8",
        },
        lookup: publicOnlyLookup,
        // No socket pooling: every connection performs its own validated DNS lookup.
        agent: false,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const location = res.headers.location;
        if (status >= 300 && status < 400 && location) {
          settle(() =>
            resolve({ status, headers: res.headers, location, body: Buffer.alloc(0), truncated: false }),
          );
          res.resume();
          req.destroy();
          return;
        }

        let stream: Readable = res;
        const encoding = String(res.headers["content-encoding"] ?? "").trim().toLowerCase();
        if (encoding === "gzip" || encoding === "x-gzip") stream = res.pipe(zlib.createGunzip());
        else if (encoding === "deflate") stream = res.pipe(zlib.createInflate());
        else if (encoding === "br") stream = res.pipe(zlib.createBrotliDecompress());

        const chunks: Buffer[] = [];
        let size = 0;
        stream.on("data", (chunk: Buffer) => {
          if (settled) return;
          const remaining = opts.maxBytes - size;
          if (chunk.length >= remaining) {
            chunks.push(chunk.subarray(0, remaining));
            settle(() =>
              resolve({ status, headers: res.headers, body: Buffer.concat(chunks), truncated: true }),
            );
            req.destroy();
            return;
          }
          chunks.push(chunk);
          size += chunk.length;
        });
        stream.on("end", () =>
          settle(() =>
            resolve({ status, headers: res.headers, body: Buffer.concat(chunks), truncated: false }),
          ),
        );
        stream.on("error", (err) => settle(() => reject(toSafeError(err))));
        if (stream !== res) res.on("error", (err) => settle(() => reject(toSafeError(err))));
      },
    );

    const timer = setTimeout(() => {
      settle(() => reject(new SafeFetchError("TIMEOUT", `Request timed out after ${opts.timeoutMs}ms`)));
      req.destroy();
    }, opts.timeoutMs);

    req.on("error", (err) => settle(() => reject(toSafeError(err))));
    req.end();
  });
}

function flattenHeaders(headers: http.IncomingHttpHeaders): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (value === undefined) continue;
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }
  return out;
}

export function decodeBody(body: Buffer, contentTypeHeader: string): string {
  let charset = /charset\s*=\s*["']?([\w.:-]+)/i.exec(contentTypeHeader)?.[1];
  if (!charset) {
    const head = body.subarray(0, 4096).toString("latin1");
    charset = /<meta[^>]+charset\s*=\s*["']?\s*([\w.:-]+)/i.exec(head)?.[1];
  }
  if (body[0] === 0xef && body[1] === 0xbb && body[2] === 0xbf) charset = "utf-8";
  try {
    return new TextDecoder(charset || "utf-8").decode(body);
  } catch {
    return new TextDecoder("utf-8").decode(body);
  }
}

export async function safeFetch(input: string | URL, options: SafeFetchOptions = {}): Promise<SafeResponse> {
  const opts: Required<SafeFetchOptions> = {
    timeoutMs: options.timeoutMs ?? 20_000,
    maxBytes: options.maxBytes ?? 5 * 1024 * 1024,
    maxRedirects: options.maxRedirects ?? 5,
    userAgent: options.userAgent ?? crawlerUserAgent(),
    accept: options.accept ?? "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  };

  let url = assertFetchableUrl(input);
  const redirects: string[] = [];
  for (let hop = 0; ; hop++) {
    const result = await requestOnce(url, opts);
    if (result.location !== undefined) {
      if (hop >= opts.maxRedirects) {
        throw new SafeFetchError("TOO_MANY_REDIRECTS", `More than ${opts.maxRedirects} redirects`);
      }
      redirects.push(url.toString());
      let next: URL;
      try {
        next = new URL(result.location, url);
      } catch {
        throw new SafeFetchError("INVALID_URL", `Invalid redirect location: ${result.location.slice(0, 200)}`);
      }
      url = assertFetchableUrl(next);
      continue;
    }

    const headers = flattenHeaders(result.headers);
    const contentTypeHeader = headers["content-type"] ?? "";
    const body = result.body;
    return {
      url: url.toString(),
      status: result.status,
      headers,
      contentType: contentTypeHeader.split(";")[0].trim().toLowerCase(),
      body,
      truncated: result.truncated,
      redirects,
      text: () => decodeBody(body, contentTypeHeader),
    };
  }
}
