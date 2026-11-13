import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { webhookEvents } from "@/db/schema";
import { notifyAfterSync, syncFromPayment, syncSubscription } from "@/lib/billing";
import { getDodo } from "@/lib/dodo";

type DodoWebhookEvent = ReturnType<ReturnType<typeof getDodo>["webhooks"]["unwrap"]>;
type SubscriptionEvent = Extract<DodoWebhookEvent, { type: `subscription.${string}` }>;

function isSubscriptionEvent(event: DodoWebhookEvent): event is SubscriptionEvent {
  return event.type.startsWith("subscription.");
}

async function handleEvent(event: DodoWebhookEvent): Promise<void> {
  if (isSubscriptionEvent(event)) {
    // Payloads carry the subscription's latest state, so syncing is idempotent and order-independent.
    await notifyAfterSync(await syncSubscription(event.data));
    return;
  }
  if (event.type === "payment.succeeded") {
    // Links the subscription via our checkout session even if subscription metadata is missing.
    await notifyAfterSync(await syncFromPayment(event.data));
  }
}

/**
 * Dodo Payments webhook endpoint (Standard Webhooks). Configure it in the Dodo
 * dashboard under Developer → Webhooks as https://YOUR_DOMAIN/api/webhooks/dodo.
 */
export async function POST(req: Request): Promise<Response> {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_KEY;
  if (!webhookKey || !process.env.DODO_PAYMENTS_API_KEY) {
    console.error("[webhook] DODO_PAYMENTS_WEBHOOK_KEY and DODO_PAYMENTS_API_KEY must be set");
    return Response.json({ error: "Webhooks are not configured" }, { status: 500 });
  }

  const webhookId = req.headers.get("webhook-id");
  const signature = req.headers.get("webhook-signature");
  const timestamp = req.headers.get("webhook-timestamp");
  if (!webhookId || !signature || !timestamp) {
    return Response.json({ error: "Missing webhook signature headers" }, { status: 400 });
  }

  const rawBody = await req.text();
  let event: DodoWebhookEvent;
  try {
    // The headers must always be passed: the SDK skips verification when they're omitted.
    event = getDodo().webhooks.unwrap(rawBody, {
      headers: {
        "webhook-id": webhookId,
        "webhook-signature": signature,
        "webhook-timestamp": timestamp,
      },
      key: webhookKey,
    });
  } catch (err) {
    console.warn("[webhook] rejected: invalid signature or timestamp", (err as Error).message);
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  }

  const db = getDb();
  const inserted = await db
    .insert(webhookEvents)
    .values({ id: webhookId, type: event.type, payload: event as unknown as Record<string, unknown> })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (inserted.length === 0) {
    const [existing] = await db
      .select({ processedAt: webhookEvents.processedAt })
      .from(webhookEvents)
      .where(eq(webhookEvents.id, webhookId));
    if (existing?.processedAt) return Response.json({ received: true, duplicate: true });
  }

  try {
    await handleEvent(event);
    await db.update(webhookEvents).set({ processedAt: new Date(), error: null }).where(eq(webhookEvents.id, webhookId));
    return Response.json({ received: true });
  } catch (err) {
    console.error(`[webhook] failed to process ${event.type} (${webhookId})`, err);
    await db
      .update(webhookEvents)
      .set({ error: (err instanceof Error ? err.message : String(err)).slice(0, 1000) })
      .where(eq(webhookEvents.id, webhookId))
      .catch(() => undefined);
    // A non-2xx response makes Dodo retry with exponential backoff.
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
