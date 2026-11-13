import "server-only";
import { APIError as DodoAPIError } from "dodopayments";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { checkoutSessions, websites } from "@/db/schema";
import type { PlanId } from "@/lib/constants";
import { getDodo, productIdForPlan } from "@/lib/dodo";
import { appUrl, ConfigError } from "@/lib/env";
import type { SessionUser } from "./session";

/**
 * Creates a Dodo hosted checkout for one website subscription and records the
 * session so the resulting payment can always be traced back to the website.
 */
export async function createCheckoutForWebsite(
  user: SessionUser,
  website: { id: string; domain: string; url: string },
  plan: PlanId,
): Promise<string> {
  const productId = productIdForPlan(plan);
  if (!productId) throw new ConfigError(`DODO_PRODUCT_ID_${plan.toUpperCase()} is not set`);

  const base = appUrl();
  const params = {
    product_cart: [{ product_id: productId, quantity: 1 }],
    // No query string here: Dodo appends ?subscription_id=...&status=... to this URL.
    return_url: `${base}/dashboard/checkout/${website.id}`,
    cancel_url: `${base}/dashboard/websites/${website.id}?checkout=cancelled`,
    // Set server-side and not editable by the customer, so webhooks can trust it.
    metadata: {
      website_id: website.id,
      user_id: user.id,
      plan,
      website_domain: website.domain,
      website_url: website.url,
    },
    feature_flags: { redirect_immediately: true },
  };

  const dodo = getDodo();
  const newCustomer = { email: user.email, name: user.name };
  let session;
  try {
    session = await dodo.checkoutSessions.create({
      ...params,
      customer: user.dodoCustomerId ? { customer_id: user.dodoCustomerId } : newCustomer,
    });
  } catch (err) {
    // A stored customer id can be invalid after switching between test and live mode.
    const customerRejected = err instanceof DodoAPIError && (err.status === 404 || err.status === 422 || err.status === 400);
    if (!user.dodoCustomerId || !customerRejected) throw err;
    console.warn("[checkout] stored Dodo customer id was rejected, retrying with email", { userId: user.id });
    session = await dodo.checkoutSessions.create({ ...params, customer: newCustomer });
  }
  if (!session.checkout_url) throw new Error("Dodo Payments did not return a checkout URL");

  await getDb().transaction(async (tx) => {
    await tx.insert(checkoutSessions).values({
      id: session.session_id,
      websiteId: website.id,
      userId: user.id,
      plan,
      productId,
    });
    await tx
      .update(websites)
      .set({ checkoutSessionId: session.session_id, updatedAt: new Date() })
      .where(eq(websites.id, website.id));
  });
  return session.checkout_url;
}
