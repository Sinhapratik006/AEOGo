import { safeFetch, type SafeResponse } from "../net/safe-fetch";
import { ANSWER_ENGINE_BOTS, checkLlmsTxt, checkRobots, discoverSitemapUrls, type RobotsInfo } from "./access";
import { analyzePage, type IssueInput, type PageRecord } from "./analyze";

const SKIP_EXTENSIONS =
  /\.(?:jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|heic|pdf|zip|gz|tgz|rar|7z|tar|bz2|mp4|m4v|mov|avi|wmv|webm|mkv|mp3|wav|ogg|flac|m4a|css|js|mjs|map|json|xml|rss|atom|txt|csv|tsv|xlsx?|docx?|pptx?|odt|rtf|woff2?|ttf|otf|eot|exe|msi|dmg|pkg|apk|iso|bin)$/i;
const MAX_CONSECUTIVE_FAILURES = 25;

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
  try {
    homepageRes = await safeFetch(homepageUrl);
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

  const processResponse = async (requestedUrl: string, res: SafeResponse) => {
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
  await processResponse(homepageUrl, homepageRes);
  if (!result.homepage) {
    result.fatalError =
      homepageRes.status >= 400
        ? `Your homepage returned HTTP ${homepageRes.status}.`
        : "Your homepage didn't return an HTML page.";
    return result;
  }
  for (const url of sitemap.urls) enqueue(url);

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
    try {
      res = await safeFetch(url);
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

    await processResponse(url, res);
    if (!(await callbacks.onProgress(result.pagesCrawled, `Crawled ${result.pagesCrawled} pages`))) {
      result.aborted = true;
      break;
    }
  }

  result.ok = true;
  return result;
}
