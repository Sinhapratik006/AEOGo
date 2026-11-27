import { appUrl } from "@/lib/env";
import { auditIntervalLabel, PLAN_LIST } from "@/lib/plans";

export function GET() {
  const base = appUrl();
  const plans = PLAN_LIST.map(
    (p) =>
      `- ${p.name}: $${p.priceMonthly}/month per website, up to ${p.maxPages} pages per audit, ${auditIntervalLabel(p.auditIntervalHours).toLowerCase()} automatic audits, ${p.aiDraftsPerAudit} AI-written fixes per audit.`,
  ).join("\n");

  const body = `# AEOGo

> AEOGo is an automated AEO (Answer Engine Optimization), SEO (Search Engine Optimization) and GEO (Generative Engine Optimization) service. It audits websites for Google and for AI engines such as ChatGPT, Perplexity, Claude, Gemini and Google AI Overviews, scores each of the three separately, writes the fixes with AI, and re-audits automatically.

Customers subscribe to a plan per website and enter the website's URL. Once payment is confirmed, AEOGo crawls the site and checks AEO signals (AI crawler access in robots.txt, llms.txt, structured data, answer-first content, JavaScript-dependent content), SEO signals (sitemaps, indexing, canonicals, titles and meta descriptions, headings, image alt text, internal links, HTTPS, speed and mobile) and GEO signals (statistics, cited sources, author and date signals, lists and tables, quotable paragraphs and brand entity markup). It then generates AI-written metadata, an llms.txt file, a corrected robots.txt and schema markup. Fixes are suggestions; AEOGo never edits customer websites.

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
