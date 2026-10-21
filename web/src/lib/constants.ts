// Shared, dependency-free constants. Safe to import from the DB schema, the
// proxy, client components and the worker.

export const PLAN_IDS = ["starter", "growth", "pro"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export const WEBSITE_STATUSES = [
  "pending_payment",
  "active",
  "past_due",
  "on_hold",
  "paused",
  "cancelled",
  "expired",
  "payment_failed",
] as const;
export type WebsiteStatus = (typeof WEBSITE_STATUSES)[number];

/** Website statuses for which the AEO automation keeps running. */
export const AUTOMATION_STATUSES: readonly WebsiteStatus[] = ["active", "past_due"];

/** Website statuses that represent a live (not ended) subscription. */
export const LIVE_SUBSCRIPTION_STATUSES: readonly WebsiteStatus[] = [
  "active",
  "past_due",
  "on_hold",
  "paused",
];

/** Website statuses from which the customer can start a (new) checkout. */
export const CHECKOUT_ALLOWED_STATUSES: readonly WebsiteStatus[] = [
  "pending_payment",
  "payment_failed",
  "cancelled",
  "expired",
];

export type AuditStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export type AuditTrigger = "initial" | "scheduled" | "manual";
export type Severity = "high" | "medium" | "low";
export type DraftField = "title" | "description" | "llms_txt" | "robots_txt" | "jsonld";
export type DraftStatus = "draft" | "approved" | "rejected";

export const SESSION_COOKIE = "aeogo_session";
export const SESSION_TTL_DAYS = 30;

export function isAutomationStatus(status: WebsiteStatus): boolean {
  return AUTOMATION_STATUSES.includes(status);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}
