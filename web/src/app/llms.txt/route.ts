import { appUrl } from "@/lib/env";
import { auditIntervalLabel, PLAN_LIST } from "@/lib/plans";

export function GET() {
  const base = appUrl();
  const plans = PLAN_LIST.map(
    (p) =>
      `- ${p.name}: $${p.priceMonthly}/month per website, up to ${p.maxPages} pages per audit, ${auditIntervalLabel(p.auditIntervalHours).toLowerCase()} automatic audits, ${p.aiDraftsPerAudit} AI-written fixes per audit.`,
  ).join("\n");

  const body = `# AEOGo

> AEOGo is an automated Answer Engine Optimization (AEO) service. It audits websites for AI answer engines such as ChatGPT, Perplexity, Claude, Gemini and Google AI Overviews, writes the fixes with AI, and re-audits automatically.

Customers subscribe to a plan per website and enter the website's URL. Once payment is confirmed, AEOGo crawls the site, checks AI crawler access in robots.txt, sitemaps, structured data (JSON-LD), titles and meta descriptions, answer-first content, author and date signals and JavaScript-dependent content, then generates AI-written metadata, an llms.txt file, a corrected robots.txt and schema markup. Fixes are suggestions; AEOGo never edits customer websites.

## Plans

${plans}

## Pages

- [Home](${base}/): What AEOGo does, how it works and frequently asked questions.
- [Pricing](${base}/pricing): Plans and a feature comparison.
- [About AEOGoBot](${base}/bot): How the AEOGo crawler identifies itself and behaves.
- [Terms of Service](${base}/terms)
- [Privacy Policy](${base}/privacy)
- [Refund Policy](${base}/refund-policy)
`;
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
