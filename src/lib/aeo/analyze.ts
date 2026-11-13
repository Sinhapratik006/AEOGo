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
}

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

function parseJsonLd($: CheerioRoot): { types: string[]; problems: string[]; hasAuthorOrDate: boolean } {
  const types = new Set<string>();
  const problems = new Set<string>();
  let hasAuthorOrDate = false;
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
        for (const t of Array.isArray(rawType) ? rawType : [rawType]) {
          if (typeof t === "string" && t.trim()) types.add(t.trim());
        }
        if (!topLevelContext && !("@context" in item)) problems.add("JSON-LD missing @context");
        if ("author" in item || "datePublished" in item || "dateModified" in item) hasAuthorOrDate = true;
      }
    });

  return { types: [...types].sort(), problems: [...problems], hasAuthorOrDate };
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

/** Runs the deterministic AEO checks for one HTML page. */
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
    },
    issues,
    links,
  };
}
