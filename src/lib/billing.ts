import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { getDb, type Transaction } from "@/db";
import { audits, checkoutSessions, subscriptions, users, websites, type Website } from "@/db/schema";
import { enqueueAudit } from "./audits";
import { AUTOMATION_STATUSES, isUuid, type WebsiteStatus } from "./constants";
import { getDodo, planForProductId } from "./dodo";
import { automationStartedEmail, paymentIssueEmail, sendEmailSafely } from "./email";
import { isPlanId } from "./plans";
import { normalizeWebsiteUrl } from "./url";

/** The subset of a Dodo subscription we rely on. Webhook payloads and API responses both satisfy it. */
export interface SubscriptionSnapshot {
  subscription_id: string;
  status: string;
  product_id: string;
  customer: { customer_id: string; email: string; name?: string | null };
  metadata?: Record<string, string | number | boolean> | null;
  next_billing_date?: string | null;
  cancel_at_next_billing_date?: boolean | null;
  recurring_pre_tax_amount?: number | null;
  currency?: string | null;
}

export interface PaymentSnapshot {
  payment_id: string;
  subscription_id?: string | null;
  checkout_session_id?: string | null;
}

export interface SyncResult {
  websiteId: string | null;
  linked: boolean;
  duplicate: boolean;
  previousStatus: WebsiteStatus | null;
  status: WebsiteStatus | null;
  /** True the first time automation is switched on for the website. */
  activatedNow: boolean;
}

const WEBSITE_STATUS_BY_SUBSCRIPTION_STATUS: Record<string, WebsiteStatus> = {
  pending: "pending_payment",
  active: "active",
  past_due: "past_due",
  on_hold: "on_hold",
  paused: "paused",
  cancelled: "cancelled",
  expired: "expired",
  failed: "payment_failed",
};

const ENDED_SUBSCRIPTION_STATUSES = new Set(["cancelled", "expired", "failed"]);

export function websiteStatusFor(subscriptionStatus: string): WebsiteStatus {
  return WEBSITE_STATUS_BY_SUBSCRIPTION_STATUS[subscriptionStatus] ?? "pending_payment";
}

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Re-creates a website row from checkout metadata (set by our server, not editable by
 * the customer). If the customer has since re-added the same URL, that row is used.
 */
async function restoreRemovedWebsite(
  tx: Transaction,
  websiteId: string,
  sub: SubscriptionSnapshot,
): Promise<Website | undefined> {
  const userId = sub.metadata?.user_id;
  const rawUrl = sub.metadata?.website_url ?? sub.metadata?.website_domain;
  if (!isUuid(userId) || typeof rawUrl !== "string") return undefined;
  const normalized = normalizeWebsiteUrl(rawUrl);
  if (!normalized.ok) return undefined;
  const [owner] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId));
  if (!owner) return undefined;

  const [sameUrl] = await tx
    .select()
    .from(websites)
    .where(and(eq(websites.userId, userId), eq(websites.url, normalized.url)))
    .for("update");
  if (sameUrl) return sameUrl;

  const metadataPlan = sub.metadata?.plan;
  const [restored] = await tx
    .insert(websites)
    .values({
      id: websiteId,
      userId,
      url: normalized.url,
      domain: normalized.domain,
      plan: planForProductId(sub.product_id) ?? (isPlanId(metadataPlan) ? metadataPlan : "starter"),
      status: "pending_payment",
    })
    .onConflictDoNothing()
    .returning();
  if (restored) console.warn("[billing] restored a removed website for a paid subscription", { websiteId });
  return restored;
}

/**
 * Applies the latest state of a Dodo subscription to our database. Idempotent and
 * safe to call concurrently (row locks), so it can be driven by webhooks, the
 * post-checkout sync and API responses alike.
 *
 * The subscription is matched to a website by, in order: an existing link, the
 * caller-verified `trustedWebsiteId` (derived from our own checkout session), or
 * the `website_id` metadata we attached to the checkout session.
 */
export async function syncSubscription(
  sub: SubscriptionSnapshot,
  options: { trustedWebsiteId?: string } = {},
): Promise<SyncResult> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const now = new Date();
    const [existing] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, sub.subscription_id))
      .for("update");

    let candidateId: string | null = existing?.websiteId ?? null;
    let matchedByMetadataOnly = false;
    if (!candidateId) {
      const [linkedWebsite] = await tx
        .select({ id: websites.id })
        .from(websites)
        .where(eq(websites.subscriptionId, sub.subscription_id))
        .limit(1);
      candidateId = linkedWebsite?.id ?? null;
    }
    if (!candidateId && options.trustedWebsiteId) candidateId = options.trustedWebsiteId;
    const metadataWebsiteId = sub.metadata?.website_id;
    if (!candidateId && isUuid(metadataWebsiteId)) {
      candidateId = metadataWebsiteId;
      matchedByMetadataOnly = true;
    }

    let website: Website | undefined;
    if (candidateId) {
      [website] = await tx.select().from(websites).where(eq(websites.id, candidateId)).for("update");
      if (!website && matchedByMetadataOnly && !ENDED_SUBSCRIPTION_STATUSES.has(sub.status)) {
        // Paid for a website that was removed meanwhile: restore it so the payment isn't orphaned.
        website = await restoreRemovedWebsite(tx, candidateId, sub);
      } else if (website && matchedByMetadataOnly) {
        const metadataUserId = sub.metadata?.user_id;
        if (typeof metadataUserId === "string" && metadataUserId !== website.userId) {
          console.warn("[billing] metadata user mismatch, refusing to link", {
            subscriptionId: sub.subscription_id,
            websiteId: website.id,
          });
          website = undefined;
        }
      }
    }

    let link = false;
    if (website) {
      if (!website.subscriptionId || website.subscriptionId === sub.subscription_id) {
        link = true;
      } else {
        // The website already has another subscription. Replace it only if that one has
        // ended and this one is live (e.g. a resubscription after cancelling).
        const [current] = await tx
          .select({ status: subscriptions.status })
          .from(subscriptions)
          .where(eq(subscriptions.id, website.subscriptionId));
        const currentEnded = !current || ENDED_SUBSCRIPTION_STATUSES.has(current.status);
        link = currentEnded && !ENDED_SUBSCRIPTION_STATUSES.has(sub.status);
      }
    }
    const duplicate = Boolean(website) && !link && !ENDED_SUBSCRIPTION_STATUSES.has(sub.status);
    if (duplicate) {
      console.warn("[billing] a second live subscription was paid for one website", {
        subscriptionId: sub.subscription_id,
        websiteId: website?.id,
        linkedSubscriptionId: website?.subscriptionId,
      });
    }

    const row = {
      userId: website?.userId ?? existing?.userId ?? null,
      websiteId: website?.id ?? existing?.websiteId ?? null,
      customerId: sub.customer?.customer_id ?? null,
      productId: sub.product_id ?? null,
      status: sub.status,
      recurringAmount: sub.recurring_pre_tax_amount ?? null,
      currency: sub.currency ?? null,
      nextBillingDate: parseDate(sub.next_billing_date),
      cancelAtPeriodEnd: Boolean(sub.cancel_at_next_billing_date),
      isDuplicate: duplicate,
      updatedAt: now,
    };
    await tx
      .insert(subscriptions)
      .values({ id: sub.subscription_id, ...row })
      .onConflictDoUpdate({ target: subscriptions.id, set: row });

    if (!website) {
      console.warn("[billing] subscription could not be matched to a website yet", {
        subscriptionId: sub.subscription_id,
        status: sub.status,
      });
      return {
        websiteId: null,
        linked: false,
        duplicate: false,
        previousStatus: null,
        status: null,
        activatedNow: false,
      };
    }
    if (!link) {
      return {
        websiteId: website.id,
        linked: false,
        duplicate,
        previousStatus: website.status,
        status: website.status,
        activatedNow: false,
      };
    }

    const newStatus = websiteStatusFor(sub.status);
    const wasAutomated = AUTOMATION_STATUSES.includes(website.status);
    const isAutomated = AUTOMATION_STATUSES.includes(newStatus);
    const update: Partial<typeof websites.$inferInsert> = {
      subscriptionId: sub.subscription_id,
      subscriptionStatus: sub.status,
      status: newStatus,
      plan: planForProductId(sub.product_id) ?? website.plan,
      productId: sub.product_id,
      nextBillingDate: parseDate(sub.next_billing_date),
      cancelAtPeriodEnd: Boolean(sub.cancel_at_next_billing_date),
      updatedAt: now,
    };

    let activatedNow = false;
    if (isAutomated && !wasAutomated) {
      if (!website.activatedAt) {
        update.activatedAt = now;
        activatedNow = true;
      }
      if (!website.lastAuditAt) {
        await enqueueAudit(tx, website.id, "initial");
      } else if (!website.nextAuditAt || website.nextAuditAt < now) {
        update.nextAuditAt = now;
      }
    }
    if (!isAutomated) {
      await tx
        .update(audits)
        .set({ status: "cancelled", finishedAt: now, error: "Subscription is not active" })
        .where(and(eq(audits.websiteId, website.id), eq(audits.status, "queued")));
    }

    await tx.update(websites).set(update).where(eq(websites.id, website.id));

    if (sub.customer?.customer_id) {
      await tx
        .update(users)
        .set({ dodoCustomerId: sub.customer.customer_id, updatedAt: now })
        .where(and(eq(users.id, website.userId), isNull(users.dodoCustomerId)));
    }

    return {
      websiteId: website.id,
      linked: true,
      duplicate: false,
      previousStatus: website.status,
      status: newStatus,
      activatedNow,
    };
  });
}

/**
 * Links a payment's subscription to the website it was bought for, using the
 * checkout session we created. Used for `payment.*` webhooks so activation works
 * even when subscription metadata is unavailable.
 */
export async function syncFromPayment(payment: PaymentSnapshot): Promise<SyncResult | null> {
  if (!payment.subscription_id) return null;
  const db = getDb();
  const [known] = await db
    .select({ websiteId: subscriptions.websiteId })
    .from(subscriptions)
    .where(eq(subscriptions.id, payment.subscription_id));
  if (known?.websiteId) return null; // Already linked; subscription events keep it in sync.

  let trustedWebsiteId: string | undefined;
  if (payment.checkout_session_id) {
    const [session] = await db
      .select({ websiteId: checkoutSessions.websiteId })
      .from(checkoutSessions)
      .where(eq(checkoutSessions.id, payment.checkout_session_id));
    trustedWebsiteId = session?.websiteId;
  }
  const sub = await getDodo().subscriptions.retrieve(payment.subscription_id);
  return syncSubscription(sub, { trustedWebsiteId });
}

/**
 * Asks Dodo directly about the website's recent checkout sessions. Lets the
 * post-checkout page activate the subscription even if webhooks are delayed or
 * not configured (e.g. in local development).
 */
export async function syncWebsiteFromCheckout(websiteId: string): Promise<SyncResult | null> {
  const db = getDb();
  const recent = await db
    .select({ id: checkoutSessions.id })
    .from(checkoutSessions)
    .where(
      and(
        eq(checkoutSessions.websiteId, websiteId),
        gte(checkoutSessions.createdAt, new Date(Date.now() - 48 * 60 * 60 * 1000)),
      ),
    )
    .orderBy(desc(checkoutSessions.createdAt))
    .limit(5);

  const dodo = getDodo();
  for (const session of recent) {
    const status = await dodo.checkoutSessions.retrieve(session.id);
    if (!status.payment_id) continue;
    const payment = await dodo.payments.retrieve(status.payment_id);
    if (!payment.subscription_id) continue;
    const sub = await dodo.subscriptions.retrieve(payment.subscription_id);
    return syncSubscription(sub, { trustedWebsiteId: websiteId });
  }
  return null;
}

/** Sends lifecycle emails after a sync. Never throws. */
export async function notifyAfterSync(result: SyncResult | null): Promise<void> {
  if (!result?.websiteId || !result.linked) return;
  const enteredOnHold = result.status === "on_hold" && result.previousStatus !== "on_hold";
  if (!result.activatedNow && !enteredOnHold) return;
  try {
    const db = getDb();
    const [row] = await db
      .select({ domain: websites.domain, email: users.email, name: users.name })
      .from(websites)
      .innerJoin(users, eq(users.id, websites.userId))
      .where(eq(websites.id, result.websiteId));
    if (!row) return;
    if (result.activatedNow) {
      await sendEmailSafely(automationStartedEmail(row.email, row.name, row.domain, result.websiteId));
    }
    if (enteredOnHold) {
      await sendEmailSafely(paymentIssueEmail(row.email, row.name, row.domain));
    }
  } catch (err) {
    console.error("[billing] failed to send lifecycle email", err);
  }
}
