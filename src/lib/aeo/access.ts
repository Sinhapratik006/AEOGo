import zlib from "node:zlib";
import robotsParser from "robots-parser";
import { safeFetch } from "../net/safe-fetch";
import type { IssueInput } from "./analyze";

export type Robot = ReturnType<typeof robotsParser>;

/** Crawlers that power AI answers and citations. Blocking these is a high-severity issue. */
export const ANSWER_ENGINE_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
];

/** Crawlers that collect AI training data. Blocking these is a deliberate choice for some sites. */
export const TRAINING_BOTS = ["Google-Extended", "Applebot-Extended", "CCBot", "Meta-ExternalAgent"];

export const CRAWLER_TOKEN = "AEOGoBot";

export interface RobotsInfo {
  url: string;
  exists: boolean;
  content: string;
  robot: Robot | null;
  sitemaps: string[];
  blockedAnswerBots: string[];
  blockedTrainingBots: string[];
  crawlDelaySeconds: number | null;
  issues: IssueInput[];
}

export async function checkRobots(origin: string): Promise<RobotsInfo> {
  const url = `${origin}/robots.txt`;
  const info: RobotsInfo = {
    url,
    exists: false,
    content: "",
    robot: null,
    sitemaps: [],
    blockedAnswerBots: [],
    blockedTrainingBots: [],
    crawlDelaySeconds: null,
    issues: [],
  };
  const issue = (code: string, severity: IssueInput["severity"], detail: string | null) =>
    info.issues.push({ url, code, severity, detail });

  let res;
  try {
    res = await safeFetch(url, { timeoutMs: 15_000, maxBytes: 512 * 1024, accept: "text/plain,*/*;q=0.5" });
  } catch (err) {
    issue("ROBOTS_UNREADABLE", "medium", (err as Error).message);
    return info;
  }

  if (res.status === 404 || res.status === 410) {
    issue("ROBOTS_MISSING", "low", `HTTP ${res.status}`);
    return info;
  }
  if (res.status >= 500 || res.status === 429) {
    // RFC 9309: crawlers must treat a server error as "disallow everything".
    issue("ROBOTS_UNREADABLE", "high", `HTTP ${res.status}: crawlers treat this as "disallow everything"`);
    return info;
  }
  if (res.status >= 400) {
    issue("ROBOTS_UNREADABLE", "medium", `HTTP ${res.status}`);
    return info;
  }

  const content = res.text();
  if (res.contentType.includes("html") || /^\s*<(!doctype|html)/i.test(content)) {
    issue("ROBOTS_MISSING", "low", "robots.txt returns an HTML page instead of rules");
    return info;
  }

  info.exists = true;
  info.content = content;
  const robot = robotsParser(url, content);
  info.robot = robot;
  info.sitemaps = robot.getSitemaps();
  const delay = robot.getCrawlDelay(CRAWLER_TOKEN);
  info.crawlDelaySeconds = typeof delay === "number" && Number.isFinite(delay) ? delay : null;

  const root = `${origin}/`;
  info.blockedAnswerBots = ANSWER_ENGINE_BOTS.filter((bot) => robot.isAllowed(root, bot) === false);
  info.blockedTrainingBots = TRAINING_BOTS.filter((bot) => robot.isAllowed(root, bot) === false);
  if (info.blockedAnswerBots.length) {
    issue("AI_BOT_BLOCKED", "high", `${info.blockedAnswerBots.join(", ")} disallowed`);
  }
  if (info.blockedTrainingBots.length) {
    issue("AI_TRAINING_BOT_BLOCKED", "medium", `${info.blockedTrainingBots.join(", ")} disallowed`);
  }
  return info;
}

function decodeXmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*(?:<!\[CDATA\[)?\s*([\s\S]*?)\s*(?:\]\]>)?\s*<\/loc>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(xml)) !== null) {
    const loc = decodeXmlEntities(match[1].trim());
    if (loc) locs.push(loc);
  }
  return locs;
}

async function fetchSitemap(url: string): Promise<{ kind: "index" | "urlset"; locs: string[] } | null> {
  try {
    const res = await safeFetch(url, {
      timeoutMs: 20_000,
      maxBytes: 20 * 1024 * 1024,
      accept: "application/xml,text/xml;q=0.9,*/*;q=0.5",
    });
    if (res.status >= 400) return null;
    let xml: string;
    if (res.body[0] === 0x1f && res.body[1] === 0x8b) {
      xml = zlib.gunzipSync(res.body, { maxOutputLength: 50 * 1024 * 1024 }).toString("utf8");
    } else {
      xml = res.text();
    }
    if (/<sitemapindex[\s>]/i.test(xml)) return { kind: "index", locs: extractLocs(xml) };
    if (/<urlset[\s>]/i.test(xml)) return { kind: "urlset", locs: extractLocs(xml) };
    return null;
  } catch {
    return null;
  }
}

/** Collects page URLs from declared (robots.txt) or conventional sitemap locations. */
export async function discoverSitemapUrls(
  origin: string,
  declared: string[],
  limit: number,
): Promise<{ found: boolean; urls: string[]; issues: IssueInput[] }> {
  const roots = declared.length ? declared.slice(0, 5) : [`${origin}/sitemap.xml`, `${origin}/sitemap_index.xml`];
  const urls = new Set<string>();
  const children: string[] = [];
  let found = false;

  for (const root of roots) {
    const sitemap = await fetchSitemap(root);
    if (!sitemap) continue;
    found = true;
    if (sitemap.kind === "index") children.push(...sitemap.locs);
    else for (const loc of sitemap.locs) if (urls.size < limit) urls.add(loc);
    if (!declared.length) break;
  }
  for (const child of children.slice(0, 10)) {
    if (urls.size >= limit) break;
    const sitemap = await fetchSitemap(child);
    if (sitemap?.kind !== "urlset") continue;
    for (const loc of sitemap.locs) if (urls.size < limit) urls.add(loc);
  }

  const issues: IssueInput[] = found
    ? []
    : [
        {
          url: roots[0],
          code: "SITEMAP_MISSING",
          severity: "medium",
          detail: declared.length ? "Sitemaps listed in robots.txt could not be loaded" : "No sitemap at /sitemap.xml",
        },
      ];
  return { found, urls: [...urls], issues };
}

export async function checkLlmsTxt(origin: string): Promise<boolean> {
  try {
    const res = await safeFetch(`${origin}/llms.txt`, {
      timeoutMs: 15_000,
      maxBytes: 512 * 1024,
      accept: "text/plain,text/markdown;q=0.9,*/*;q=0.5",
    });
    if (res.status !== 200 || res.contentType.includes("html")) return false;
    const text = res.text().trim();
    return text.length > 0 && !/^<(!doctype|html)/i.test(text);
  } catch {
    return false;
  }
}
