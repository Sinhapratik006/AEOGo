import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Relative imports only: drizzle-kit loads this file without tsconfig path aliases.
import type {
  AuditStatus,
  AuditTrigger,
  DraftField,
  DraftStatus,
  PlanId,
  Severity,
  WebsiteStatus,
} from "../lib/constants";

const tstz = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    dodoCustomerId: text("dodo_customer_id"),
    createdAt: tstz("created_at").notNull().defaultNow(),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_key").on(t.email)],
);

export const sessions = pgTable(
  "sessions",
  {
    // SHA-256 of the session token. The raw token only lives in the user's cookie.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: tstz("expires_at").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
    userAgent: text("user_agent"),
    ip: text("ip"),
  },
  (t) => [
    index("sessions_user_id_idx").on(t.userId),
    index("sessions_expires_at_idx").on(t.expiresAt),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    // SHA-256 of the reset token.
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: tstz("expires_at").notNull(),
    usedAt: tstz("used_at"),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [index("password_reset_tokens_user_id_idx").on(t.userId)],
);

/** One row per website a customer pays to optimize (one subscription each). */
export const websites = pgTable(
  "websites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Normalized origin, e.g. https://www.example.com */
    url: text("url").notNull(),
    domain: text("domain").notNull(),
    plan: text("plan").$type<PlanId>().notNull(),
    status: text("status").$type<WebsiteStatus>().notNull().default("pending_payment"),
    checkoutSessionId: text("checkout_session_id"),
    subscriptionId: text("subscription_id"),
    subscriptionStatus: text("subscription_status"),
    productId: text("product_id"),
    nextBillingDate: tstz("next_billing_date"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    latestScore: integer("latest_score"),
    lastAuditAt: tstz("last_audit_at"),
    nextAuditAt: tstz("next_audit_at"),
    activatedAt: tstz("activated_at"),
    createdAt: tstz("created_at").notNull().defaultNow(),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("websites_user_url_key").on(t.userId, t.url),
    uniqueIndex("websites_subscription_id_key").on(t.subscriptionId),
    index("websites_due_idx").on(t.status, t.nextAuditAt),
  ],
);

/** Every Dodo checkout session we create, so payments can always be traced to a website. */
export const checkoutSessions = pgTable(
  "checkout_sessions",
  {
    id: text("id").primaryKey(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    plan: text("plan").$type<PlanId>().notNull(),
    productId: text("product_id").notNull(),
    createdAt: tstz("created_at").notNull().defaultNow(),
  },
  (t) => [index("checkout_sessions_website_id_idx").on(t.websiteId, t.createdAt)],
);

/** Mirror of Dodo subscriptions, kept in sync by webhooks. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: text("id").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    websiteId: uuid("website_id").references(() => websites.id, { onDelete: "set null" }),
    customerId: text("customer_id"),
    productId: text("product_id"),
    status: text("status").notNull(),
    recurringAmount: integer("recurring_amount"),
    currency: text("currency"),
    nextBillingDate: tstz("next_billing_date"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").notNull().default(false),
    /** True when this subscription was paid for a website that already had a live subscription. */
    isDuplicate: boolean("is_duplicate").notNull().default(false),
    createdAt: tstz("created_at").notNull().defaultNow(),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("subscriptions_user_id_idx").on(t.userId),
    index("subscriptions_website_id_idx").on(t.websiteId),
  ],
);

/** Audit runs. Doubles as the worker's job queue. */
export const audits = pgTable(
  "audits",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    status: text("status").$type<AuditStatus>().notNull().default("queued"),
    trigger: text("trigger").$type<AuditTrigger>().notNull(),
    attempts: integer("attempts").notNull().default(0),
    workerId: text("worker_id"),
    progress: text("progress"),
    pagesCrawled: integer("pages_crawled").notNull().default(0),
    issuesHigh: integer("issues_high").notNull().default(0),
    issuesMedium: integer("issues_medium").notNull().default(0),
    issuesLow: integer("issues_low").notNull().default(0),
    draftsCreated: integer("drafts_created").notNull().default(0),
    score: integer("score"),
    error: text("error"),
    queuedAt: tstz("queued_at").notNull().defaultNow(),
    startedAt: tstz("started_at"),
    heartbeatAt: tstz("heartbeat_at"),
    finishedAt: tstz("finished_at"),
  },
  (t) => [
    index("audits_website_id_idx").on(t.websiteId, t.queuedAt),
    index("audits_status_idx").on(t.status, t.queuedAt),
    // At most one queued/running audit per website, enforced by the database.
    uniqueIndex("audits_one_open_per_website")
      .on(t.websiteId)
      .where(sql`status in ('queued', 'running')`),
  ],
);

export const pages = pgTable(
  "pages",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    statusCode: integer("status_code"),
    title: text("title"),
    description: text("description"),
    h1Count: integer("h1_count"),
    words: integer("words"),
    schemaTypes: text("schema_types"),
    issueCount: integer("issue_count").notNull().default(0),
    score: integer("score"),
    textExcerpt: text("text_excerpt"),
  },
  (t) => [index("pages_audit_id_idx").on(t.auditId)],
);

export const issues = pgTable(
  "issues",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    auditId: uuid("audit_id")
      .notNull()
      .references(() => audits.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    code: text("code").notNull(),
    severity: text("severity").$type<Severity>().notNull(),
    detail: text("detail"),
  },
  (t) => [index("issues_audit_id_idx").on(t.auditId, t.severity)],
);

/** AI-written and generated fixes. Never published automatically. */
export const drafts = pgTable(
  "drafts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    websiteId: uuid("website_id")
      .notNull()
      .references(() => websites.id, { onDelete: "cascade" }),
    auditId: uuid("audit_id").references(() => audits.id, { onDelete: "set null" }),
    url: text("url").notNull(),
    field: text("field").$type<DraftField>().notNull(),
    currentValue: text("current_value"),
    proposed: text("proposed").notNull(),
    rationale: text("rationale"),
    needsReview: boolean("needs_review").notNull().default(false),
    status: text("status").$type<DraftStatus>().notNull().default("draft"),
    createdAt: tstz("created_at").notNull().defaultNow(),
    updatedAt: tstz("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("drafts_website_id_idx").on(t.websiteId, t.status),
    index("drafts_website_url_field_idx").on(t.websiteId, t.url, t.field),
  ],
);

/** Processed Dodo webhook deliveries, keyed by the `webhook-id` header (idempotency). */
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload"),
  receivedAt: tstz("received_at").notNull().defaultNow(),
  processedAt: tstz("processed_at"),
  error: text("error"),
});

/** Fixed-window rate limit counters shared by every app instance. */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  windowStart: tstz("window_start").notNull(),
});

export type User = typeof users.$inferSelect;
export type Website = typeof websites.$inferSelect;
export type Audit = typeof audits.$inferSelect;
export type Page = typeof pages.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type Draft = typeof drafts.$inferSelect;
export type SubscriptionRow = typeof subscriptions.$inferSelect;
