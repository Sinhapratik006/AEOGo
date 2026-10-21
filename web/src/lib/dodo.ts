import DodoPayments from "dodopayments";
import { PLAN_IDS, type PlanId } from "./constants";
import { ConfigError } from "./env";

let client: DodoPayments | null = null;

export function dodoEnvironment(): "test_mode" | "live_mode" {
  // Defaults to test mode so a missing variable can never charge real cards.
  return process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode";
}

export function getDodo(): DodoPayments {
  if (!client) {
    const bearerToken = process.env.DODO_PAYMENTS_API_KEY;
    if (!bearerToken) {
      throw new ConfigError("DODO_PAYMENTS_API_KEY is not set. See .env.example.");
    }
    client = new DodoPayments({
      bearerToken,
      webhookKey: process.env.DODO_PAYMENTS_WEBHOOK_KEY || null,
      environment: dodoEnvironment(),
      timeout: 20_000,
      maxRetries: 2,
    });
  }
  return client;
}

/** Dodo product id for a plan, from DODO_PRODUCT_ID_STARTER / _GROWTH / _PRO. */
export function productIdForPlan(plan: PlanId): string | null {
  return process.env[`DODO_PRODUCT_ID_${plan.toUpperCase()}`]?.trim() || null;
}

export function planForProductId(productId: string | null | undefined): PlanId | null {
  if (!productId) return null;
  for (const plan of PLAN_IDS) {
    if (productIdForPlan(plan) === productId) return plan;
  }
  return null;
}

export function missingBillingConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.DODO_PAYMENTS_API_KEY) missing.push("DODO_PAYMENTS_API_KEY");
  if (!process.env.DODO_PAYMENTS_WEBHOOK_KEY) missing.push("DODO_PAYMENTS_WEBHOOK_KEY");
  for (const plan of PLAN_IDS) {
    if (!productIdForPlan(plan)) missing.push(`DODO_PRODUCT_ID_${plan.toUpperCase()}`);
  }
  return missing;
}
