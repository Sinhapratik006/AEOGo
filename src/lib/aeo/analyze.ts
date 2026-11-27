import * as cheerio from "cheerio";
import type { Severity } from "../constants";

export interface IssueInput {
  url: string;
  code: string;
  severity: Severity;
  detail: string | null;
}

export interface PageRecord {
  url: string;
  statusCode: number;
  title: string;
  description: string;
  h1Count: number;
  words: number;
  schemaTypes: string[];
  textExcerpt: string;
  ogSiteName: string | null;
  noindex: boolean;
  /** Organization/Person/LocalBusiness JSON-LD on the page: absent, present without sameAs, or complete. */
  entity: EntityMarkup;
}

export type EntityMarkup = "none" | "no-sameas" | "ok";

export interface PageAnalysis {
  record: PageRecord;
  issues: IssueInput[];
  links: string[];
}

type CheerioRoot = ReturnType<typeof cheerio.load>;
type DomNode = { type: string; data?: string; children?: DomNode[] };

const EXCLUDED_FROM_TEXT = "script, style, noscript, template, svg, iframe, nav, footer";
const JS_APP_ROOTS = "#root, #app, #__next, #___gatsby, #svelte, [data-reactroot], [ng-app], [data-server-rendered]";

export function normalizeSpace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function countWords(text: string): number {
  return text ? text.split(" ").filter(Boolean).length : 0;
}

/** Text of all descendant text nodes, separated by spaces (cheerio's .text() glues blocks together). */
function collectText(node: DomNode, out: string[]): void {
  if (node.type === "text") {
    if (node.data) out.push(node.data);
    return;
  }
  if (node.children) {
    for (const child of node.children) collectText(child, out);
  }
}

function metaContent($: CheerioRoot, attr: "name" | "property", value: string): string {
  const el = $("meta")
    .filter((_, e) => ($(e).attr(attr) ?? "").trim().toLowerCase() === value)
    .first();
  return normalizeSpace(el.attr("content") ?? "");
}

/** Schema.org types that identify the brand or person behind a site. */
const ENTITY_TYPE = /Organization|Corporation|LocalBusiness|Person|Store|Restaurant|Brand/;

function parseJsonLd($: CheerioRoot): { types: string[]; problems: string[]; hasAuthorOrDate: boolean; entity: EntityMarkup } {
  const types = new Set<string>();
  const problems = new Set<string>();
  let hasAuthorOrDate = false;
  let entity: EntityMarkup = "none";
  const isObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

  $("script")
    .filter((_, e) => ($(e).attr("type") ?? "").trim().toLowerCase() === "application/ld+json")
    .each((_, e) => {
      const raw = $(e).text().trim();
      if (!raw) return;
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        problems.add("Invalid JSON-LD (parse error)");
        return;
      }
      const topLevelContext = isObject(data) && "@context" in data;
      const items: unknown[] = Array.isArray(data)
        ? data
        : isObject(data) && Array.isArray(data["@graph"])
          ? (data["@graph"] as unknown[])
          : [data];
      for (const item of items) {
        if (!isObject(item)) continue;
        const rawType = item["@type"];
        let isEntity = false;
        for (const t of Array.isArray(rawType) ? rawType : [rawType]) {
          if (typeof t === "string" && t.trim()) {
            types.add(t.trim());
            if (ENTITY_TYPE.test(t)) isEntity = true;
          }
        }
        if (isEntity) {
          const sameAs = item.sameAs;
          const hasSameAs = Array.isArray(sameAs) ? sameAs.length > 0 : typeof sameAs === "string" && sameAs.trim() !== "";
          if (hasSameAs) entity = "ok";
          else if (entity === "none") entity = "no-sameas";
        }
        if (!topLevelContext && !("@context" in item)) problems.add("JSON-LD missing @context");
        if ("author" in item || "datePublished" in item || "dateModified" in item) hasAuthorOrDate = true;
      }
    });

  return { types: [...types].sort(), problems: [...problems], hasAuthorOrDate, entity };
}

function extractLinks($: CheerioRoot, pageUrl: string): string[] {
  let base: URL;
  try {
    base = new URL($("base[href]").first().attr("href") ?? pageUrl, pageUrl);
  } catch {
    base = new URL(pageUrl);
  }
  const links = new Set<string>();
  $("a[href]").each((_, e) => {
    const href = ($(e).attr("href") ?? "").trim();
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript|data|sms|ftp):/i.test(href)) return;
    try {
      const url = new URL(href, base);
      if (url.protocol !== "http:" && url.protocol !== "https:") return;
      url.hash = "";
      links.add(url.toString());
    } catch {
      // Ignore malformed links.
    }
  });
  return [...links];
}

const LARGE_HTML_BYTES = 1_000_000;
const MAX_FRIENDLY_URL_LENGTH = 100;

function bareHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, "");
}

/** Classic SEO checks that don't depend on AEO signals. Must run before the DOM is modified. */
function seoChecks(
  $: CheerioRoot,
  url: string,
  html: string,
  links: string[],
  add: (code: string, severity: Severity, detail?: string) => void,
): void {
  const page = new URL(url);

  if (!($("html").first().attr("lang") ?? "").trim()) add("SEO_LANG_MISSING", "low");

  const hasViewport = $("meta").filter((_, e) => ($(e).attr("name") ?? "").trim().toLowerCase() === "viewport").length > 0;
  if (!hasViewport) add("SEO_VIEWPORT_MISSING", "high");

  const missingSocial = ["og:title", "og:description", "og:image"].filter((p) => !metaContent($, "property", p));
  if (!metaContent($, "name", "twitter:card")) missingSocial.push("twitter:card");
  if (missingSocial.length) add("SEO_OPEN_GRAPH_MISSING", "low", `missing ${missingSocial.join(", ")}`);

  const canonicalHref = $("link[href]")
    .filter((_, e) => ($(e).attr("rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"))
    .first()
    .attr("href");
  if (canonicalHref) {
    try {
      const canonical = new URL(canonicalHref.trim(), url);
      if (bareHost(canonical.hostname) !== bareHost(page.hostname)) {
        add("SEO_CANONICAL_OFFSITE", "medium", `points to ${canonical.origin}`);
      }
    } catch {
      add("SEO_CANONICAL_OFFSITE", "medium", "canonical URL is not valid");
    }
  }

  if (page.protocol === "https:") {
    const insecure = $("img[src], script[src], iframe[src], link[rel~='stylesheet'][href], source[src], video[src], audio[src]").filter(
      (_, e) => /^http:\/\//i.test(($(e).attr("src") ?? $(e).attr("href") ?? "").trim()),
    ).length;
    if (insecure) add("SEO_MIXED_CONTENT", "medium", `${insecure} insecure resources`);
  }

  const urlProblems: string[] = [];
  if (url.length > MAX_FRIENDLY_URL_LENGTH) urlProblems.push(`${url.length} characters`);
  if (/[A-Z]/.test(page.pathname)) urlProblems.push("uppercase letters");
  if (page.pathname.includes("_")) urlProblems.push("underscores");
  if (/%20|\+/.test(page.pathname)) urlProblems.push("spaces");
  if (urlProblems.length) add("SEO_URL_UNFRIENDLY", "low", urlProblems.join(", "));

  const self = url.replace(/\/$/, "");
  const internalLinks = links.filter((link) => {
    try {
      return bareHost(new URL(link).hostname) === bareHost(page.hostname) && link.replace(/\/$/, "") !== self;
    } catch {
      return false;
    }
  });
  if (internalLinks.length === 0) add("SEO_NO_INTERNAL_LINKS", "low");

  const imagesWithoutSize = $("img").filter((_, e) => {
    const img = $(e);
    if (img.attr("width") && img.attr("height")) return false;
    // Sized by inline CSS (e.g. Next.js <Image fill>) doesn't shift the layout either.
    const style = (img.attr("style") ?? "").toLowerCase();
    return !(/(^|;)\s*width\s*:/.test(style) && /(^|;)\s*height\s*:/.test(style));
  }).length;
  if (imagesWithoutSize) add("SEO_IMG_DIMENSIONS_MISSING", "low", `${imagesWithoutSize} images`);

  const bytes = Buffer.byteLength(html, "utf8");
  if (bytes > LARGE_HTML_BYTES) add("SEO_LARGE_PAGE", "low", `${Math.round(bytes / 1024)} KB of HTML`);
}

/** GEO content checks only apply to pages with enough text to be a source (not contact or login pages). */
const GEO_MIN_WORDS = 300;
const GEO_LONG_PARAGRAPH_WORDS = 150;
const STATISTIC =
  /\d+(?:[.,]\d+)?\s?(?:%|percent\b|per cent\b)|[$€£¥₹]\s?\d|\b\d{1,3}(?:,\d{3})+\b|\b\d+(?:\.\d+)?\s?(?:million|billion|trillion|thousand|bn|km|kg|lbs?|mph|hours|minutes|days|weeks|months|years|times)\b/i;
const QUESTION_HEADING = /\?\s*$|^(how|what|why|when|where|which|who|can|should|is|are|do|does)\b/i;
const QA_SCHEMA = /^(FAQPage|QAPage|HowTo)$/;

/**
 * Generative Engine Optimization checks: is this page the kind of source an AI assistant
 * would quote? Runs on the main content after navigation and footers are removed.
 */
function geoChecks(
  $: CheerioRoot,
  main: ReturnType<CheerioRoot>,
  url: string,
  text: string,
  words: number,
  schemaTypes: string[],
  add: (code: string, severity: Severity, detail?: string) => void,
): void {
  if (words < GEO_MIN_WORDS) return;
  const pageHost = bareHost(new URL(url).hostname);

  if (!STATISTIC.test(text)) add("GEO_NO_STATISTICS", "low", `${words} words without a statistic`);

  const externalLinks = main.find("a[href]").filter((_, e) => {
    try {
      const link = new URL(($(e).attr("href") ?? "").trim(), url);
      return /^https?:$/.test(link.protocol) && bareHost(link.hostname) !== pageHost;
    } catch {
      return false;
    }
  }).length;
  if (externalLinks === 0 && main.find("blockquote, q, cite").length === 0) {
    add("GEO_NO_SOURCES", "low", "no outbound source links or quotes");
  }

  const questionHeadings = main.find("h2, h3").filter((_, e) => QUESTION_HEADING.test(normalizeSpace($(e).text()))).length;
  if (questionHeadings === 0 && !schemaTypes.some((t) => QA_SCHEMA.test(t))) add("GEO_NO_QUESTION_HEADINGS", "low");

  if (main.find("ul, ol, table, dl").length === 0) add("GEO_NO_LISTS_OR_TABLES", "low");

  const longParagraphs = main
    .find("p")
    .filter((_, e) => countWords(normalizeSpace($(e).text())) > GEO_LONG_PARAGRAPH_WORDS).length;
  if (longParagraphs) {
    add("GEO_LONG_PARAGRAPHS", "low", `${longParagraphs} paragraph${longParagraphs === 1 ? "" : "s"} over ${GEO_LONG_PARAGRAPH_WORDS} words`);
  }
}

/** Runs the deterministic AEO, SEO and GEO checks for one HTML page. */
export function analyzePage(input: {
  url: string;
  status: number;
  html: string;
  headers?: Record<string, string>;
}): PageAnalysis {
  const { url, status, html } = input;
  const $ = cheerio.load(html);
  const issues: IssueInput[] = [];
  const add = (code: string, severity: Severity, detail?: string) =>
    issues.push({ url, code, severity, detail: detail ?? null });

  // Links and app-shell detection must happen before the DOM is modified below.
  const links = extractLinks($, url);
  const scriptCount = $("script").length;
  const looksLikeJsApp = $(JS_APP_ROOTS).length > 0;
  seoChecks($, url, html, links, add);

  const headTitle = $("head > title").first();
  const title = normalizeSpace((headTitle.length ? headTitle : $("title").first()).text());
  const description = metaContent($, "name", "description");
  if (!title) add("TITLE_MISSING", "high");
  else if (title.length < 15 || title.length > 65) add("TITLE_LENGTH", "low", `${title.length} characters`);
  if (!description) add("DESCRIPTION_MISSING", "high");
  else if (description.length < 70 || description.length > 165) {
    add("DESCRIPTION_LENGTH", "low", `${description.length} characters`);
  }

  const robotsMeta = $("meta")
    .filter((_, e) => ["robots", "googlebot"].includes(($(e).attr("name") ?? "").trim().toLowerCase()))
    .map((_, e) => $(e).attr("content") ?? "")
    .get()
    .join(",")
    .toLowerCase();
  const robotsHeader = (input.headers?.["x-robots-tag"] ?? "").toLowerCase();
  const noindex = robotsMeta.includes("noindex") || robotsHeader.includes("noindex");
  if (noindex) add("NOINDEX", "high", robotsHeader.includes("noindex") ? "X-Robots-Tag header" : "robots meta tag");

  const hasCanonical =
    $("link[href]").filter((_, e) =>
      ($(e).attr("rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"),
    ).length > 0;
  if (!hasCanonical) add("CANONICAL_MISSING", "medium");

  const h1Count = $("h1").length;
  if (h1Count !== 1) add("H1_COUNT", "medium", `${h1Count} h1 tags`);
  const levels = $("h1, h2, h3, h4, h5, h6")
    .map((_, e) => Number(e.tagName.slice(1)))
    .get();
  if (levels.some((level, i) => i > 0 && level - levels[i - 1] > 1)) add("HEADING_SKIP", "low", "heading levels skip");

  const imagesWithoutAlt = $("img").filter((_, e) => {
    const img = $(e);
    if (img.attr("aria-hidden") === "true" || img.attr("role") === "presentation") return false;
    return !(img.attr("alt") ?? "").trim();
  }).length;
  if (imagesWithoutAlt) add("IMG_ALT_MISSING", "low", `${imagesWithoutAlt} images`);

  const jsonLd = parseJsonLd($);
  for (const problem of jsonLd.problems) add("SCHEMA_INVALID", "high", problem);
  if (!jsonLd.types.length) add("SCHEMA_MISSING", "medium");

  // cheerio.load() always produces <html><head><body>, so <body> exists even for fragments.
  const main = $("main").first().length ? $("main").first() : $("body").first();
  main.find(EXCLUDED_FROM_TEXT).remove();
  const chunks: string[] = [];
  main.each((_, e) => collectText(e as unknown as DomNode, chunks));
  const text = normalizeSpace(chunks.join(" "));
  const words = countWords(text);
  if (words < 150) add("THIN_CONTENT", "medium", `${words} words`);
  geoChecks($, main, url, text, words, jsonLd.types, add);

  // Answer-first: the first paragraph after the H1 should be a concise, direct answer.
  if (h1Count > 0) {
    const firstH1 = $("h1").get(0);
    let afterH1 = false;
    let firstParagraphWords: number | null = null;
    $("h1, p").each((_, e) => {
      if (e === firstH1) {
        afterH1 = true;
        return;
      }
      if (afterH1 && e.tagName.toLowerCase() === "p") {
        firstParagraphWords = countWords(normalizeSpace($(e).text()));
        return false;
      }
    });
    if (firstParagraphWords !== null && firstParagraphWords > 80) {
      add("NO_ANSWER_FIRST", "low", `first paragraph is ${firstParagraphWords} words`);
    }
  }

  const hasItemprop =
    $("[itemprop]").filter((_, e) => /author|datePublished|dateModified/i.test($(e).attr("itemprop") ?? "")).length > 0;
  if (!(hasItemprop || $("time").length > 0 || metaContent($, "name", "author") || jsonLd.hasAuthorOrDate)) {
    add("TRUST_SIGNALS_MISSING", "low", "no author/date markup found");
  }

  if (words < 50 && (looksLikeJsApp || scriptCount >= 5)) {
    add("JS_DEPENDENT_CONTENT", "high", `only ${words} words in the HTML; the content is probably rendered by JavaScript`);
  }

  return {
    record: {
      url,
      statusCode: status,
      title,
      description,
      h1Count,
      words,
      schemaTypes: jsonLd.types,
      textExcerpt: text.slice(0, 4000),
      ogSiteName: metaContent($, "property", "og:site_name") || null,
      noindex,
      entity: jsonLd.entity,
    },
    issues,
    links,
  };
}
