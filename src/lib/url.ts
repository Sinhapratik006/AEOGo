import { isBlockedHostname } from "./net/hostnames";

export type NormalizeResult =
  | { ok: true; url: string; domain: string }
  | { ok: false; error: string };

const LABEL_RE = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/;
const TLD_RE = /^(?:xn--[a-z0-9-]{1,59}|[a-z]{2,63})$/;
const IPV4_RE = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/**
 * Normalizes user input like "Example.com/about" into a site origin
 * ("https://example.com"). The whole site is audited from its root.
 */
export function normalizeWebsiteUrl(input: string): NormalizeResult {
  let raw = input.trim();
  if (!raw) return { ok: false, error: "Enter your website address." };
  if (raw.length > 2048) return { ok: false, error: "That URL is too long." };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(raw)) raw = `https://${raw}`;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, error: "That doesn't look like a valid website address." };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, error: "Only http:// and https:// websites are supported." };
  }
  if (url.username || url.password) {
    return { ok: false, error: "Remove the username/password from the URL." };
  }
  if (url.port && url.port !== "80" && url.port !== "443") {
    return { ok: false, error: "Websites on custom ports aren't supported." };
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host.startsWith("[") || IPV4_RE.test(host)) {
    return { ok: false, error: "Enter a domain name (like example.com), not an IP address." };
  }
  if (host.length > 253 || isBlockedHostname(host)) {
    return { ok: false, error: "Enter a public website domain, like example.com." };
  }
  const labels = host.split(".");
  if (labels.length < 2 || !labels.every((label) => LABEL_RE.test(label)) || !TLD_RE.test(labels[labels.length - 1])) {
    return { ok: false, error: "That doesn't look like a valid domain name." };
  }

  return { ok: true, url: `${url.protocol}//${host}`, domain: host };
}

/** Accepts only same-site relative paths, to prevent open redirects via ?next= */
export function safeNextPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return null;
  if (value.length > 512) return null;
  return value;
}
