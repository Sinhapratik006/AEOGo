import type { Severity } from "../constants";

export interface IssueInfo {
  title: string;
  why: string;
  fix: string;
  scope: "site" | "page";
  /** Optional copy-paste example of the fix. */
  example?: string;
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

  // ---- SEO-only checks (shown in the SEO tab; they don't affect the AEO score) ----
  SEO_NOT_HTTPS: {
    scope: "site",
    title: "Site isn't served over HTTPS",
    why: "Google uses HTTPS as a ranking signal, and browsers label HTTP pages as \"Not secure\", which drives visitors away.",
    fix: "Install a TLS certificate (free from Let's Encrypt or your host) and 301-redirect every http:// URL to https://.",
  },
  SEO_HTTP_NOT_REDIRECTED: {
    scope: "site",
    title: "HTTP version doesn't redirect to HTTPS",
    why: "When both http:// and https:// load, search engines can index duplicates and split ranking signals between them.",
    fix: "Add a permanent (301) redirect from every http:// URL to the same https:// URL.",
    example: "# nginx\nserver {\n  listen 80;\n  server_name example.com www.example.com;\n  return 301 https://$host$request_uri;\n}",
  },
  SEO_VIEWPORT_MISSING: {
    scope: "page",
    title: "No mobile viewport tag",
    why: "Google indexes the mobile version of your site first. Without a viewport tag the page renders as a zoomed-out desktop page on phones.",
    fix: "Add a responsive viewport meta tag to the <head>.",
    example: '<meta name="viewport" content="width=device-width, initial-scale=1">',
  },
  SEO_LANG_MISSING: {
    scope: "page",
    title: "No language declared",
    why: "The lang attribute tells search engines which language the page is in, so it is shown to the right searchers.",
    fix: "Set the lang attribute on the <html> element.",
    example: '<html lang="en">',
  },
  SEO_OPEN_GRAPH_MISSING: {
    scope: "page",
    title: "Missing social sharing tags",
    why: "Open Graph and Twitter tags control the title, text and image shown when the page is shared, which affects clicks from social and chat apps.",
    fix: "Add og:title, og:description, og:image and twitter:card tags to the <head>.",
    example:
      '<meta property="og:title" content="Page title">\n<meta property="og:description" content="One-sentence summary of the page">\n<meta property="og:image" content="https://example.com/share-image.png">\n<meta property="og:url" content="https://example.com/page">\n<meta name="twitter:card" content="summary_large_image">',
  },
  SEO_CANONICAL_OFFSITE: {
    scope: "page",
    title: "Canonical URL points to another domain",
    why: "A canonical tag pointing to another domain tells Google to rank that domain instead of this page.",
    fix: "Point the canonical tag at this page's own preferred URL, unless the content really is a copy of another site.",
  },
  SEO_DUPLICATE_TITLE: {
    scope: "page",
    title: "Duplicate page title",
    why: "When several pages share a title, search engines can't tell them apart and may rank the wrong one, or none.",
    fix: "Give every page a unique title that describes its specific content. The Fixes tab has AI-written suggestions for some pages.",
  },
  SEO_DUPLICATE_DESCRIPTION: {
    scope: "page",
    title: "Duplicate meta description",
    why: "Repeated descriptions make search results look the same and lower click-through rates.",
    fix: "Write a unique 110–160 character description for each page.",
  },
  SEO_SLOW_RESPONSE: {
    scope: "page",
    title: "Slow server response",
    why: "Page speed is a ranking factor, and slow pages lose visitors before they load. Slow responses also limit how much Google crawls.",
    fix: "Add page caching or a CDN, optimize database queries, and upgrade hosting if the server is overloaded. Aim for under 800 ms.",
  },
  SEO_REDIRECT_CHAIN: {
    scope: "page",
    title: "Redirect chain",
    why: "Each extra redirect hop slows the page down and can lose ranking signals along the way.",
    fix: "Point links and redirects directly at the final URL so there is at most one hop.",
  },
  SEO_MIXED_CONTENT: {
    scope: "page",
    title: "Mixed content (HTTP resources on an HTTPS page)",
    why: "Browsers block or warn about insecure resources on secure pages, which breaks images and scripts and weakens trust.",
    fix: "Load every image, script, stylesheet and iframe over https://.",
  },
  SEO_URL_UNFRIENDLY: {
    scope: "page",
    title: "URL isn't search friendly",
    why: "Short, lowercase, hyphenated URLs are easier to read, share and understand for search engines and people.",
    fix: "Use lowercase words separated by hyphens and keep URLs under 100 characters. 301-redirect the old URL if you change it.",
    example: "https://example.com/blog/how-to-choose-running-shoes",
  },
  SEO_NO_INTERNAL_LINKS: {
    scope: "page",
    title: "No links to other pages on your site",
    why: "Internal links help search engines discover your pages and pass ranking strength between them. A page without them is a dead end.",
    fix: "Link to related pages, categories or your homepage with descriptive anchor text.",
  },
  SEO_IMG_DIMENSIONS_MISSING: {
    scope: "page",
    title: "Images without width and height",
    why: "Images without dimensions make the layout jump while loading (Cumulative Layout Shift), which hurts Core Web Vitals.",
    fix: "Set width and height attributes on every <img> (CSS can still make them responsive).",
    example: '<img src="/hero.jpg" width="1200" height="630" alt="Describe the image">',
  },
  SEO_LARGE_PAGE: {
    scope: "page",
    title: "Very large HTML page",
    why: "Heavy HTML downloads slowly on mobile connections and can be cut off by crawlers.",
    fix: "Remove inline data and unused markup, and paginate or lazy-load long lists.",
  },

  // ---- GEO-only checks (shown in the GEO tab; they don't affect the AEO score) ----
  GEO_NO_STATISTICS: {
    scope: "page",
    title: "No statistics or concrete numbers",
    why: "Generative engines prefer to cite pages with specific, checkable facts. Adding statistics is one of the most effective ways to get quoted in AI answers.",
    fix: "Back up key claims with concrete numbers (percentages, prices, counts, dates, measurements) and say where they come from.",
    example: "Most beginners need a half size larger than their everyday shoe: in our 2025 fitting data, 62% of 4,800 runners sized up.",
  },
  GEO_NO_SOURCES: {
    scope: "page",
    title: "No sources or quotes cited",
    why: "AI assistants weigh how verifiable a page is. Linking to authoritative sources and quoting experts makes your content more trustworthy and more likely to be cited.",
    fix: "Link to the original research, standards or official sources you rely on, and quote named experts where it helps.",
    example:
      '<p>The WHO recommends 150 minutes of moderate activity a week\n  (<a href="https://www.who.int/news-room/fact-sheets/detail/physical-activity">WHO, 2024</a>).</p>\n<blockquote cite="https://example.com/interview">\n  "Fit matters more than brand." <cite>Dr. Jane Doe, sports podiatrist</cite>\n</blockquote>',
  },
  GEO_NO_QUESTION_HEADINGS: {
    scope: "page",
    title: "No question-style headings",
    why: "People ask AI assistants questions. Headings phrased as those questions, followed by a direct answer, map neatly onto prompts and are easy for engines to lift.",
    fix: "Phrase some H2/H3 headings as the questions your customers ask, and answer each in the first 1–2 sentences below it. Add FAQPage markup for FAQ sections.",
    example: "<h2>How much should I spend on my first running shoes?</h2>\n<p>Most beginners do well with a $90–$130 neutral trainer. Spending more rarely improves comfort.</p>",
  },
  GEO_NO_LISTS_OR_TABLES: {
    scope: "page",
    title: "No lists or tables",
    why: "Generative engines extract steps, comparisons and key facts much more reliably from lists and tables than from long running text.",
    fix: "Turn steps, features, comparisons and specs into bulleted or numbered lists or an HTML table.",
    example: "<ol>\n  <li>Measure both feet in the evening.</li>\n  <li>Leave a thumb's width at the toe.</li>\n  <li>Test-run on a treadmill before buying.</li>\n</ol>",
  },
  GEO_LONG_PARAGRAPHS: {
    scope: "page",
    title: "Very long paragraphs",
    why: "AI systems split pages into passages before quoting them. Walls of text get cut mid-thought, so the key point is less likely to be cited intact.",
    fix: "Keep paragraphs under about 120 words, with one idea each and the key point in the first sentence.",
  },
  GEO_ENTITY_MISSING: {
    scope: "site",
    title: "Homepage doesn't define your brand",
    why: "Generative engines build answers around entities. Without Organization (or Person/LocalBusiness) markup on the homepage, they can confuse your brand with others or leave it out.",
    fix: "Add Organization JSON-LD to your homepage with your name, logo, URL and social profiles. A starter block is in the Fixes tab.",
  },
  GEO_ENTITY_SAMEAS_MISSING: {
    scope: "site",
    title: "Brand markup has no sameAs profiles",
    why: "sameAs links connect your site to your profiles elsewhere (LinkedIn, Wikipedia, Crunchbase, social). That helps AI models recognize your brand as one consistent entity.",
    fix: "Add a sameAs array with your official profile URLs to the Organization markup on your homepage.",
    example:
      '"sameAs": [\n  "https://www.linkedin.com/company/example",\n  "https://x.com/example",\n  "https://www.wikidata.org/wiki/Q000000"\n]',
  },
};

/** Codes that are informational only and never affect the score. */
export const INFORMATIONAL_CODES = new Set(["CRAWL_TIME_LIMIT"]);

/** Checks added for the SEO tab (by code prefix). */
export const SEO_ONLY_CODES = new Set(Object.keys(ISSUE_INFO).filter((code) => code.startsWith("SEO_")));

/** Checks added for the GEO tab (by code prefix). */
export const GEO_ONLY_CODES = new Set(Object.keys(ISSUE_INFO).filter((code) => code.startsWith("GEO_")));

type Category = { id: string; label: string; codes: string[] };

/*
 * Every scored check belongs to exactly one report, so AEO, SEO and GEO never show the
 * same issue twice, and each score only counts its own checks:
 *   AEO: can AI answer engines reach the site and pull a direct answer from each page?
 *   SEO: classic search engine setup (indexing, metadata, technical, links).
 *   GEO: is the content trustworthy and quotable enough for generative engines to cite?
 */

/** Groups shown in the AEO tab, in display order. */
export const AEO_CATEGORIES: Category[] = [
  {
    id: "access",
    label: "AI crawler access",
    codes: ["AI_BOT_BLOCKED", "AI_TRAINING_BOT_BLOCKED", "AI_BOT_BLOCKED_PAGE", "LLMS_TXT_MISSING", "JS_DEPENDENT_CONTENT"],
  },
  {
    id: "answers",
    label: "Answer-ready content",
    codes: ["NO_ANSWER_FIRST", "GEO_NO_QUESTION_HEADINGS", "THIN_CONTENT"],
  },
  {
    id: "schema",
    label: "Structured data",
    codes: ["SCHEMA_MISSING", "SCHEMA_INVALID"],
  },
];

/** Groups shown in the SEO tab, in display order. */
export const SEO_CATEGORIES: Category[] = [
  {
    id: "indexing",
    label: "Crawling & indexing",
    codes: ["ROBOTS_UNREADABLE", "ROBOTS_MISSING", "SITEMAP_MISSING", "NOINDEX", "CANONICAL_MISSING", "SEO_CANONICAL_OFFSITE", "HTTP_ERROR", "FETCH_FAILED", "HOMEPAGE_REDIRECTS_OFFSITE"],
  },
  {
    id: "onpage",
    label: "Titles, descriptions & headings",
    codes: ["TITLE_MISSING", "TITLE_LENGTH", "SEO_DUPLICATE_TITLE", "DESCRIPTION_MISSING", "DESCRIPTION_LENGTH", "SEO_DUPLICATE_DESCRIPTION", "H1_COUNT", "HEADING_SKIP"],
  },
  {
    id: "content",
    label: "Images, links & URLs",
    codes: ["IMG_ALT_MISSING", "SEO_NO_INTERNAL_LINKS", "SEO_URL_UNFRIENDLY"],
  },
  {
    id: "technical",
    label: "Security, speed & mobile",
    codes: ["SEO_NOT_HTTPS", "SEO_HTTP_NOT_REDIRECTED", "SEO_MIXED_CONTENT", "SEO_VIEWPORT_MISSING", "SEO_SLOW_RESPONSE", "SEO_REDIRECT_CHAIN", "SEO_IMG_DIMENSIONS_MISSING", "SEO_LARGE_PAGE", "SEO_LANG_MISSING"],
  },
  {
    id: "social",
    label: "Social sharing",
    codes: ["SEO_OPEN_GRAPH_MISSING"],
  },
];

/** Groups shown in the GEO tab, in display order. */
export const GEO_CATEGORIES: Category[] = [
  {
    id: "citable",
    label: "Citation-worthy content",
    codes: ["GEO_NO_STATISTICS", "GEO_NO_SOURCES", "TRUST_SIGNALS_MISSING"],
  },
  {
    id: "extractable",
    label: "Easy to extract and quote",
    codes: ["GEO_NO_LISTS_OR_TABLES", "GEO_LONG_PARAGRAPHS"],
  },
  {
    id: "entity",
    label: "Brand entity",
    codes: ["GEO_ENTITY_MISSING", "GEO_ENTITY_SAMEAS_MISSING"],
  },
];

/** Every issue code that counts toward the AEO score. */
export const AEO_CODES = new Set(AEO_CATEGORIES.flatMap((c) => c.codes));
/** Every issue code that counts toward the SEO score. */
export const SEO_CODES = new Set(SEO_CATEGORIES.flatMap((c) => c.codes));
/** Every issue code that counts toward the GEO score. */
export const GEO_CODES = new Set(GEO_CATEGORIES.flatMap((c) => c.codes));

/** Label shown with a check mark when a check passes (titles describe the failure). */
const PASSED_LABELS: Record<string, string> = {
  AI_BOT_BLOCKED: "AI answer engines allowed",
  AI_TRAINING_BOT_BLOCKED: "AI training crawlers allowed",
  AI_BOT_BLOCKED_PAGE: "Every page open to AI crawlers",
  ROBOTS_UNREADABLE: "robots.txt readable",
  ROBOTS_MISSING: "robots.txt present",
  SITEMAP_MISSING: "XML sitemap found",
  LLMS_TXT_MISSING: "llms.txt published",
  HOMEPAGE_REDIRECTS_OFFSITE: "Homepage stays on your domain",
  FETCH_FAILED: "All pages load",
  HTTP_ERROR: "No error pages",
  NOINDEX: "Pages are indexable",
  TITLE_MISSING: "Every page has a title",
  TITLE_LENGTH: "Title lengths",
  DESCRIPTION_MISSING: "Every page has a meta description",
  DESCRIPTION_LENGTH: "Description lengths",
  CANONICAL_MISSING: "Canonical URLs",
  H1_COUNT: "One H1 per page",
  HEADING_SKIP: "Heading order",
  IMG_ALT_MISSING: "Image alt text",
  SCHEMA_INVALID: "Valid structured data",
  SCHEMA_MISSING: "Structured data present",
  THIN_CONTENT: "Enough content per page",
  NO_ANSWER_FIRST: "Answers up front",
  TRUST_SIGNALS_MISSING: "Author and date signals",
  JS_DEPENDENT_CONTENT: "Content visible without JavaScript",
  SEO_NOT_HTTPS: "Served over HTTPS",
  SEO_HTTP_NOT_REDIRECTED: "HTTP redirects to HTTPS",
  SEO_VIEWPORT_MISSING: "Mobile viewport tag",
  SEO_LANG_MISSING: "Language declared",
  SEO_OPEN_GRAPH_MISSING: "Social sharing tags",
  SEO_CANONICAL_OFFSITE: "Canonicals point to your site",
  SEO_DUPLICATE_TITLE: "Unique page titles",
  SEO_DUPLICATE_DESCRIPTION: "Unique meta descriptions",
  SEO_SLOW_RESPONSE: "Fast server response",
  SEO_REDIRECT_CHAIN: "No redirect chains",
  SEO_MIXED_CONTENT: "No mixed content",
  SEO_URL_UNFRIENDLY: "Search-friendly URLs",
  SEO_NO_INTERNAL_LINKS: "Internal links",
  SEO_IMG_DIMENSIONS_MISSING: "Image dimensions set",
  SEO_LARGE_PAGE: "Reasonable page size",
  GEO_NO_STATISTICS: "Statistics and concrete numbers",
  GEO_NO_SOURCES: "Sources and quotes cited",
  GEO_NO_QUESTION_HEADINGS: "Question-style headings",
  GEO_NO_LISTS_OR_TABLES: "Lists and tables",
  GEO_LONG_PARAGRAPHS: "Short, quotable paragraphs",
  GEO_ENTITY_MISSING: "Brand defined on homepage",
  GEO_ENTITY_SAMEAS_MISSING: "Brand linked to its profiles (sameAs)",
};

export function passedLabel(code: string): string {
  return PASSED_LABELS[code] ?? issueInfo(code).title;
}

/** The report (AEO, SEO or GEO) an issue belongs to; "Info" for informational notes. */
export function issueCategory(code: string): string {
  if (AEO_CODES.has(code)) return "AEO";
  if (SEO_CODES.has(code)) return "SEO";
  if (GEO_CODES.has(code)) return "GEO";
  return "Info";
}

export function issueInfo(code: string): IssueInfo {
  return ISSUE_INFO[code] ?? { scope: "page", title: code.replace(/_/g, " ").toLowerCase(), why: "", fix: "" };
}

export const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export const META_ISSUE_CODES = ["TITLE_MISSING", "TITLE_LENGTH", "DESCRIPTION_MISSING", "DESCRIPTION_LENGTH"];
