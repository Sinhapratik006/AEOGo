import { PLAN_IDS, type PlanId } from "./constants";

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Display price in USD. The amount actually charged comes from the Dodo product. */
  priceMonthly: number;
  /** Maximum pages crawled per audit. */
  maxPages: number;
  /** Hours between automatic re-audits. */
  auditIntervalHours: number;
  /** Maximum AI-written metadata fixes per audit. */
  aiDraftsPerAudit: number;
  /** Manual "run audit now" requests allowed per 24 hours. */
  manualAuditsPerDay: number;
  highlighted?: boolean;
  features: string[];
}

export const PLANS: Record<PlanId, Plan> = {
  starter: {
    id: "starter",
    name: "Starter",
    tagline: "For small sites taking their first step into AI search.",
    priceMonthly: 29,
    maxPages: 100,
    auditIntervalHours: 24 * 7,
    aiDraftsPerAudit: 20,
    manualAuditsPerDay: 1,
    features: [
      "1 website, up to 100 pages per audit",
      "Weekly automated AEO audits",
      "20 AI-written title & description fixes per audit",
      "AI crawler access & robots.txt checks",
      "llms.txt and schema markup generator",
      "AEO score tracking",
    ],
  },
  growth: {
    id: "growth",
    name: "Growth",
    tagline: "For growing businesses that want to be cited by AI answers.",
    priceMonthly: 79,
    maxPages: 500,
    auditIntervalHours: 72,
    aiDraftsPerAudit: 60,
    manualAuditsPerDay: 3,
    highlighted: true,
    features: [
      "1 website, up to 500 pages per audit",
      "Automated audits every 3 days",
      "60 AI-written title & description fixes per audit",
      "Everything in Starter",
      "Up to 3 on-demand audits per day",
      "CSV exports of every issue",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    tagline: "For content-heavy sites that compete for every AI answer.",
    priceMonthly: 199,
    maxPages: 2000,
    auditIntervalHours: 24,
    aiDraftsPerAudit: 150,
    manualAuditsPerDay: 10,
    features: [
      "1 website, up to 2,000 pages per audit",
      "Daily automated audits",
      "150 AI-written title & description fixes per audit",
      "Everything in Growth",
      "Up to 10 on-demand audits per day",
      "Priority crawling queue",
    ],
  },
};

export const PLAN_LIST: Plan[] = PLAN_IDS.map((id) => PLANS[id]);

export function isPlanId(value: unknown): value is PlanId {
  return typeof value === "string" && (PLAN_IDS as readonly string[]).includes(value);
}

export function getPlan(id: PlanId): Plan {
  return PLANS[id];
}

export function auditIntervalLabel(hours: number): string {
  if (hours % (24 * 7) === 0) {
    const weeks = hours / (24 * 7);
    return weeks === 1 ? "Weekly" : `Every ${weeks} weeks`;
  }
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "Daily" : `Every ${days} days`;
  }
  return `Every ${hours} hours`;
}
