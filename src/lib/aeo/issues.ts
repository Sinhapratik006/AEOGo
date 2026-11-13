import type { Severity } from "../constants";

export interface IssueInfo {
  title: string;
  why: string;
  fix: string;
  scope: "site" | "page";
}

/** Human-readable explanation for every issue code the auditor can report. */
export const ISSUE_INFO: Record<string, IssueInfo> = {
  AI_BOT_BLOCKED: {
    scope: "site",
    title: "AI answer engine blocked by robots.txt",
    why: "ChatGPT, Claude and Perplexity can only cite pages their crawlers may read. A blocked crawler means that engine can't recommend you.",
    fix: "Allow these crawlers in robots.txt. Use the suggested robots.txt in the Fixes tab.",
  },
  AI_TRAINING_BOT_BLOCKED: {
    scope: "site",
    title: "AI training crawler blocked by robots.txt",
    why: "These crawlers feed AI models such as Gemini and Apple Intelligence. Blocking them can keep your brand out of what those assistants know.",
    fix: "Optional: allow them if you want your content represented in these models.",
  },
  AI_BOT_BLOCKED_PAGE: {
    scope: "page",
    title: "Page blocked for AI crawlers",
    why: "robots.txt rules stop AI answer engines from reading this specific page.",
    fix: "Remove the Disallow rule that matches this page if you want it to appear in AI answers.",
  },
  ROBOTS_UNREADABLE: {
    scope: "site",
    title: "robots.txt could not be read",
    why: "When robots.txt errors, crawlers may assume they're not allowed to read your site at all.",
    fix: "Make sure /robots.txt returns HTTP 200 with plain-text rules.",
  },
  ROBOTS_MISSING: {
    scope: "site",
    title: "No robots.txt file",
    why: "robots.txt tells AI crawlers what they may read and where your sitemap lives.",
    fix: "Publish a robots.txt that allows AI crawlers and lists your sitemap. A suggestion is in the Fixes tab.",
  },
  SITEMAP_MISSING: {
    scope: "site",
    title: "XML sitemap not found",
    why: "Sitemaps help crawlers discover every page, including ones that aren't linked prominently.",
    fix: "Publish /sitemap.xml and reference it from robots.txt with a Sitemap: line.",
  },
  LLMS_TXT_MISSING: {
    scope: "site",
    title: "No llms.txt file",
    why: "llms.txt is an emerging standard that gives AI assistants a curated map of your most important pages.",
    fix: "Publish the generated llms.txt from the Fixes tab at the root of your site (/llms.txt).",
  },
  HOMEPAGE_REDIRECTS_OFFSITE: {
    scope: "site",
    title: "Homepage redirects to another domain",
    why: "AI crawlers attribute content to the final domain. Redirecting off-site splits your authority.",
    fix: "Make sure the domain you subscribed with serves your site, or subscribe with the final domain.",
  },
  FETCH_FAILED: {
    scope: "page",
    title: "Page could not be loaded",
    why: "If our crawler can't load a page, AI crawlers probably can't either.",
    fix: "Check the page loads quickly over HTTPS without errors or bot blocking.",
  },
  HTTP_ERROR: {
    scope: "page",
    title: "Page returns an error status",
    why: "Broken pages waste crawl budget and can't be cited.",
    fix: "Fix or redirect the URL, and update internal links that point to it.",
  },
  NOINDEX: {
    scope: "page",
    title: "Page is set to noindex",
    why: "noindex tells search and answer engines to leave the page out of their results.",
    fix: "Remove the noindex directive if this page should appear in AI answers.",
  },
  TITLE_MISSING: {
    scope: "page",
    title: "Missing page title",
    why: "The title is the strongest signal of what a page is about, for search engines and AI alike.",
    fix: "Add a specific <title> under 60 characters. See the AI-written suggestion in the Fixes tab.",
  },
  TITLE_LENGTH: {
    scope: "page",
    title: "Title is too short or too long",
    why: "Titles between 15 and 65 characters are descriptive without being truncated.",
    fix: "Rewrite the title to 15–65 characters. See the AI-written suggestion in the Fixes tab.",
  },
  DESCRIPTION_MISSING: {
    scope: "page",
    title: "Missing meta description",
    why: "Descriptions give engines a ready-made summary of the page to quote.",
    fix: "Add a 110–160 character meta description. See the AI-written suggestion in the Fixes tab.",
  },
  DESCRIPTION_LENGTH: {
    scope: "page",
    title: "Meta description is too short or too long",
    why: "Descriptions between 70 and 165 characters summarize well without truncation.",
    fix: "Rewrite the description to about 110–160 characters.",
  },
  CANONICAL_MISSING: {
    scope: "page",
    title: "No canonical URL",
    why: "Without a canonical tag, duplicate URLs can split signals between versions of the same page.",
    fix: 'Add <link rel="canonical" href="..."> pointing to the preferred URL.',
  },
  H1_COUNT: {
    scope: "page",
    title: "Page should have exactly one H1",
    why: "A single clear H1 tells engines the main topic of the page.",
    fix: "Use one H1 for the main topic and H2/H3 for sections.",
  },
  HEADING_SKIP: {
    scope: "page",
    title: "Heading levels skip",
    why: "Skipping levels (H2 to H4) makes the content outline harder for machines to parse.",
    fix: "Nest headings in order: H1, then H2, then H3.",
  },
  IMG_ALT_MISSING: {
    scope: "page",
    title: "Images without alt text",
    why: "Alt text lets AI understand images and improves accessibility.",
    fix: "Add short, descriptive alt text to meaningful images.",
  },
  SCHEMA_INVALID: {
    scope: "page",
    title: "Invalid structured data",
    why: "Broken JSON-LD is ignored by engines, so the page loses rich context.",
    fix: "Fix the JSON syntax and make sure every block has an @context.",
  },
  SCHEMA_MISSING: {
    scope: "page",
    title: "No structured data",
    why: "Schema.org markup tells engines exactly what a page describes (organization, product, article, FAQ).",
    fix: "Add JSON-LD for the page type. A starter Organization/WebSite block is in the Fixes tab.",
  },
  THIN_CONTENT: {
    scope: "page",
    title: "Thin content",
    why: "Pages with fewer than 150 words rarely contain enough substance to be quoted as an answer.",
    fix: "Expand the page with useful detail that answers your visitors' questions.",
  },
  NO_ANSWER_FIRST: {
    scope: "page",
    title: "Answer isn't up front",
    why: "Answer engines favor pages that answer the question in the first paragraph after the heading.",
    fix: "Open with a concise 1–3 sentence answer (under 80 words), then go into detail.",
  },
  TRUST_SIGNALS_MISSING: {
    scope: "page",
    title: "No author or date signals",
    why: "Author and publish/update dates help engines judge expertise and freshness.",
    fix: "Show the author and last-updated date, and mark them up (e.g. datePublished in JSON-LD).",
  },
  JS_DEPENDENT_CONTENT: {
    scope: "page",
    title: "Content depends on JavaScript",
    why: "Most AI crawlers (GPTBot, ClaudeBot, PerplexityBot) don't run JavaScript, so they see an empty page.",
    fix: "Server-render or pre-render the main content so it's present in the HTML.",
  },
  CRAWL_TIME_LIMIT: {
    scope: "site",
    title: "Crawl stopped at the time limit",
    why: "Very slow or very large sites can't be fully crawled in one audit. This doesn't affect your score.",
    fix: "Improve server response times so more pages fit in each audit.",
  },
};

/** Codes that are informational only and never affect the score. */
export const INFORMATIONAL_CODES = new Set(["CRAWL_TIME_LIMIT"]);

export function issueInfo(code: string): IssueInfo {
  return ISSUE_INFO[code] ?? { scope: "page", title: code.replace(/_/g, " ").toLowerCase(), why: "", fix: "" };
}

export const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export const META_ISSUE_CODES = ["TITLE_MISSING", "TITLE_LENGTH", "DESCRIPTION_MISSING", "DESCRIPTION_LENGTH"];
