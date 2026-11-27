import { safeFetch, type SafeResponse } from "../net/safe-fetch";
import { ANSWER_ENGINE_BOTS, checkLlmsTxt, checkRobots, discoverSitemapUrls, type RobotsInfo } from "./access";
import { analyzePage, type IssueInput, type PageRecord } from "./analyze";

const SKIP_EXTENSIONS =
  /\.(?:jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|heic|pdf|zip|gz|tgz|rar|7z|tar|bz2|mp4|m4v|mov|avi|wmv|webm|mkv|mp3|wav|ogg|flac|m4a|css|js|mjs|map|json|xml|rss|atom|txt|csv|tsv|xlsx?|docx?|pptx?|odt|rtf|woff2?|ttf|otf|eot|exe|msi|dmg|pkg|apk|iso|bin)$/i;
const MAX_CONSECUTIVE_FAILURES = 25;
const SLOW_RESPONSE_MS = 1_500;
const VERY_SLOW_RESPONSE_MS = 3_000;
/** At most this many affected URLs are recorded per duplicate title/description. */
const MAX_DUPLICATE_URLS = 20;

export interface CrawledPage {
  record: PageRecord;
  issues: IssueInput[];
}

export interface PageSummary {
  url: string;
  title: string;
  description: string;
}

export interface CrawlOptions {
  maxPages: number;
  delayMs: number;
  /** Stop crawling (gracefully) after this many milliseconds. */
  timeBudgetMs: number;
}

export interface CrawlCallbacks {
  onPage(page: CrawledPage): Promise<void>;
  /** Called regularly. Return false to abort the crawl. */
  onProgress(pagesCrawled: number, message: string): Promise<boolean>;
}

export interface CrawlResult {
  ok: boolean;
  fatalError: string | null;
  aborted: boolean;
  origin: string;
  pagesCrawled: number;
  siteIssues: IssueInput[];
  robots: RobotsInfo | null;
  sitemapFound: boolean;
  llmsTxtExists: boolean;
  homepage: PageRecord | null;
  pages: PageSummary[];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** www.example.com and example.com are treated as the same site. */
function sameSite(a: string, b: string): boolean {
  return a.replace(/^www\./, "") === b.replace(/^www\./, "");
}

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function isHtmlResponse(res: SafeResponse): boolean {
  if (res.contentType) return res.contentType.includes("html");
  return /<html|<!doctype html/i.test(res.body.subarray(0, 2048).toString("latin1"));
}

function emptyRecord(url: string, statusCode: number): PageRecord {
  return {
    url,
    statusCode,
    title: "",
    description: "",
    h1Count: 0,
    words: 0,
    schemaTypes: [],
    textExcerpt: "",
    ogSiteName: null,
    noindex: false,
    entity: "none",
  };
}

/**
 * Crawls a site breadth-first from its homepage and sitemap, running the AEO checks
 * on every HTML page. Pages are streamed to `onPage` so memory stays flat.
 */
export async function crawlSite(siteUrl: string, options: CrawlOptions, callbacks: CrawlCallbacks): Promise<CrawlResult> {
  const startedAt = Date.now();
  const siteHost = new URL(siteUrl).hostname;
  const homepageUrl = `${siteUrl}/`;
  const siteIssues: IssueInput[] = [];
  const result: CrawlResult = {
    ok: false,
    fatalError: null,
    aborted: false,
    origin: new URL(siteUrl).origin,
    pagesCrawled: 0,
    siteIssues,
    robots: null,
    sitemapFound: false,
    llmsTxtExists: false,
    homepage: null,
    pages: [],
  };

  await callbacks.onProgress(0, "Loading your homepage");
  let homepageRes: SafeResponse;
  let homepageMs = 0;
  try {
    const fetchStart = Date.now();
    homepageRes = await safeFetch(homepageUrl);
    homepageMs = Date.now() - fetchStart;
  } catch (err) {
    const message = (err as Error).message;
    siteIssues.push({ url: homepageUrl, code: "FETCH_FAILED", severity: "high", detail: message });
    result.fatalError = `We couldn't load ${homepageUrl}: ${message}`;
    return result;
  }

  // Follow the homepage's redirect to pick the canonical host (e.g. example.com -> www.example.com).
  const finalHost = new URL(homepageRes.url).hostname;
  const allowedHosts = new Set([siteHost]);
  if (finalHost !== siteHost) {
    if (sameSite(finalHost, siteHost)) {
      allowedHosts.add(finalHost);
    } else {
      siteIssues.push({
        url: homepageUrl,
        code: "HOMEPAGE_REDIRECTS_OFFSITE",
        severity: "high",
        detail: `Redirects to ${new URL(homepageRes.url).origin}`,
      });
    }
  }
  const origin = allowedHosts.has(finalHost) ? new URL(homepageRes.url).origin : result.origin;
  result.origin = origin;

  await callbacks.onProgress(0, "Checking HTTPS");
  siteIssues.push(...(await checkHttps(origin, allowedHosts)));

  await callbacks.onProgress(0, "Checking robots.txt and AI crawler access");
  const robots = await checkRobots(origin);
  result.robots = robots;
  siteIssues.push(...robots.issues);

  await callbacks.onProgress(0, "Reading your sitemap");
  const sitemap = await discoverSitemapUrls(origin, robots.sitemaps, options.maxPages * 3);
  result.sitemapFound = sitemap.found;
  siteIssues.push(...sitemap.issues);

  result.llmsTxtExists = await checkLlmsTxt(origin);
  if (!result.llmsTxtExists) {
    siteIssues.push({ url: `${origin}/llms.txt`, code: "LLMS_TXT_MISSING", severity: "low", detail: null });
  }

  const delayMs = Math.max(options.delayMs, Math.min((robots.crawlDelaySeconds ?? 0) * 1000, 10_000));
  const queue: string[] = [];
  const queued = new Set<string>();
  const seen = new Set<string>();
  const titles = new Map<string, string[]>();
  const descriptions = new Map<string, string[]>();
  const remember = (map: Map<string, string[]>, key: string, url: string) => {
    if (!key) return;
    const urls = map.get(key.toLowerCase()) ?? [];
    if (urls.length < MAX_DUPLICATE_URLS) urls.push(url);
    map.set(key.toLowerCase(), urls);
  };

  const enqueue = (raw: string) => {
    const normalized = normalizeUrl(raw);
    if (!normalized || queued.has(normalized) || seen.has(normalized)) return;
    const url = new URL(normalized);
    if (!allowedHosts.has(url.hostname)) return;
    // Query-string variants (filters, sorting, tracking) are skipped to avoid crawl traps.
    if (url.search) return;
    if (SKIP_EXTENSIONS.test(url.pathname)) return;
    if (queue.length >= options.maxPages * 20) return;
    queued.add(normalized);
    queue.push(normalized);
  };

  const processResponse = async (requestedUrl: string, res: SafeResponse, elapsedMs: number) => {
    const finalUrl = normalizeUrl(res.url) ?? requestedUrl;
    if (finalUrl !== requestedUrl) {
      if (seen.has(finalUrl)) return; // Redirected to a page we already processed.
      seen.add(finalUrl);
      if (!allowedHosts.has(new URL(finalUrl).hostname) && requestedUrl !== homepageUrl) return;
    }

    if (res.status >= 400) {
      result.pagesCrawled++;
      await callbacks.onPage({
        record: emptyRecord(finalUrl, res.status),
        issues: [{ url: finalUrl, code: "HTTP_ERROR", severity: "high", detail: `HTTP ${res.status}` }],
      });
      return;
    }
    if (!isHtmlResponse(res)) return;

    result.pagesCrawled++;
    const analysis = analyzePage({ url: finalUrl, status: res.status, html: res.text(), headers: res.headers });

    if (elapsedMs >= SLOW_RESPONSE_MS) {
      analysis.issues.push({
        url: finalUrl,
        code: "SEO_SLOW_RESPONSE",
        severity: elapsedMs >= VERY_SLOW_RESPONSE_MS ? "medium" : "low",
        detail: `${(elapsedMs / 1000).toFixed(1)} s to load`,
      });
    }
    if (res.redirects.length >= 2) {
      analysis.issues.push({
        url: finalUrl,
        code: "SEO_REDIRECT_CHAIN",
        severity: "low",
        detail: `${res.redirects.length} redirects from ${res.redirects[0]}`,
      });
    }
    if (!analysis.record.noindex) {
      remember(titles, analysis.record.title, finalUrl);
      remember(descriptions, analysis.record.description, finalUrl);
    }

    // Page-level AI access, only meaningful when the site as a whole is open to these bots.
    if (robots.robot && robots.blockedAnswerBots.length === 0) {
      const robot = robots.robot;
      const blocked = ANSWER_ENGINE_BOTS.filter((bot) => robot.isAllowed(finalUrl, bot) === false);
      if (blocked.length) {
        analysis.issues.push({ url: finalUrl, code: "AI_BOT_BLOCKED_PAGE", severity: "medium", detail: blocked.join(", ") });
      }
    }

    for (const link of analysis.links) enqueue(link);
    if (!result.homepage) result.homepage = analysis.record;
    if (!analysis.record.noindex && result.pages.length < 200) {
      result.pages.push({ url: finalUrl, title: analysis.record.title, description: analysis.record.description });
    }
    await callbacks.onPage({ record: analysis.record, issues: analysis.issues });
  };

  seen.add(normalizeUrl(homepageUrl) ?? homepageUrl);
  await processResponse(homepageUrl, homepageRes, homepageMs);
  if (!result.homepage) {
    result.fatalError =
      homepageRes.status >= 400
        ? `Your homepage returned HTTP ${homepageRes.status}.`
        : "Your homepage didn't return an HTML page.";
    return result;
  }
  for (const url of sitemap.urls) enqueue(url);

  // GEO: the homepage should tell AI models who the brand is.
  if (result.homepage.entity === "none") {
    siteIssues.push({ url: result.homepage.url, code: "GEO_ENTITY_MISSING", severity: "medium", detail: "no Organization or Person JSON-LD" });
  } else if (result.homepage.entity === "no-sameas") {
    siteIssues.push({ url: result.homepage.url, code: "GEO_ENTITY_SAMEAS_MISSING", severity: "low", detail: null });
  }

  let consecutiveFailures = 0;
  while (queue.length > 0 && result.pagesCrawled < options.maxPages) {
    if (Date.now() - startedAt > options.timeBudgetMs) {
      siteIssues.push({
        url: homepageUrl,
        code: "CRAWL_TIME_LIMIT",
        severity: "low",
        detail: `Stopped after ${result.pagesCrawled} pages to stay within the time limit`,
      });
      break;
    }
    const url = queue.shift() as string;
    if (seen.has(url)) continue;
    seen.add(url);

    await sleep(delayMs);
    let res: SafeResponse;
    let elapsedMs = 0;
    try {
      const fetchStart = Date.now();
      res = await safeFetch(url);
      elapsedMs = Date.now() - fetchStart;
      consecutiveFailures = 0;
    } catch (err) {
      consecutiveFailures++;
      result.pagesCrawled++;
      await callbacks.onPage({
        record: emptyRecord(url, 0),
        issues: [{ url, code: "FETCH_FAILED", severity: "high", detail: (err as Error).message }],
      });
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        siteIssues.push({
          url: homepageUrl,
          code: "FETCH_FAILED",
          severity: "high",
          detail: `Stopped after ${consecutiveFailures} consecutive failed requests (rate limiting or bot protection?)`,
        });
        break;
      }
      continue;
    }

    await processResponse(url, res, elapsedMs);
    if (!(await callbacks.onProgress(result.pagesCrawled, `Crawled ${result.pagesCrawled} pages`))) {
      result.aborted = true;
      break;
    }
  }

  siteIssues.push(
    ...duplicateIssues(titles, "SEO_DUPLICATE_TITLE", "medium"),
    ...duplicateIssues(descriptions, "SEO_DUPLICATE_DESCRIPTION", "low"),
  );
  result.ok = true;
  return result;
}

function duplicateIssues(map: Map<string, string[]>, code: string, severity: IssueInput["severity"]): IssueInput[] {
  const out: IssueInput[] = [];
  for (const urls of map.values()) {
    if (urls.length < 2) continue;
    for (const url of urls) {
      out.push({ url, code, severity, detail: `shared with ${urls.length - 1} other page${urls.length > 2 ? "s" : ""}` });
    }
  }
  return out;
}

/** Checks the site is served over HTTPS and that its http:// version redirects there. */
async function checkHttps(origin: string, allowedHosts: Set<string>): Promise<IssueInput[]> {
  const url = new URL(origin);
  if (url.protocol === "http:") {
    return [{ url: `${origin}/`, code: "SEO_NOT_HTTPS", severity: "high", detail: null }];
  }
  const httpUrl = `http://${url.host}/`;
  try {
    const res = await safeFetch(httpUrl, { timeoutMs: 10_000, maxBytes: 64 * 1024 });
    const final = new URL(res.url);
    if (res.status < 400 && (final.protocol !== "https:" || !allowedHosts.has(final.hostname))) {
      return [{ url: httpUrl, code: "SEO_HTTP_NOT_REDIRECTED", severity: "medium", detail: `served at ${res.url}` }];
    }
  } catch {
    // Port 80 closed or unreachable: there's no insecure version to redirect.
  }
  return [];
}
