import robotsParser from "robots-parser";
import type { PageRecord } from "./analyze";
import type { PageSummary } from "./crawl";

interface RobotsGroup {
  agents: string[];
  rules: string[];
}

function parseRobotsGroups(content: string): { groups: RobotsGroup[]; sitemaps: string[]; other: string[] } {
  const groups: RobotsGroup[] = [];
  const sitemaps: string[] = [];
  const other: string[] = [];
  let current: RobotsGroup | null = null;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === "user-agent") {
      if (!current || current.rules.length > 0) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value);
    } else if (key === "sitemap") {
      sitemaps.push(value);
    } else if (current) {
      const name = key === "disallow" ? "Disallow" : key === "allow" ? "Allow" : key === "crawl-delay" ? "Crawl-delay" : null;
      current.rules.push(name ? `${name}: ${value}` : line);
    } else {
      other.push(line);
    }
  }
  return { groups, sitemaps, other };
}

/**
 * Builds a corrected robots.txt that lets the blocked AI crawlers in, while keeping
 * the site's existing path restrictions (copied from the `*` group) in place.
 */
export function buildRobotsTxtSuggestion(input: {
  origin: string;
  currentContent: string;
  exists: boolean;
  blockedBots: string[];
  sitemapUrl: string | null;
}): string | null {
  const { origin, blockedBots } = input;
  if (!input.exists) {
    const lines = ["User-agent: *", "Allow: /", ""];
    if (input.sitemapUrl) lines.push(`Sitemap: ${input.sitemapUrl}`, "");
    return lines.join("\n");
  }
  if (blockedBots.length === 0) return null;

  const blocked = new Set(blockedBots.map((b) => b.toLowerCase()));
  const parsed = parseRobotsGroups(input.currentContent);

  // Keep the wildcard group's targeted restrictions, but never a blanket "Disallow: /".
  const wildcard = parsed.groups.find((g) => g.agents.some((a) => a === "*"));
  const inheritedRules = (wildcard?.rules ?? []).filter((rule) => {
    const normalized = rule.toLowerCase().replace(/\s+/g, "");
    return normalized !== "disallow:/" && normalized !== "disallow:/*" && !normalized.startsWith("allow:");
  });

  const lines: string[] = ["# Allow AI answer engines to read and cite this site"];
  for (const bot of blockedBots) lines.push(`User-agent: ${bot}`);
  lines.push(...inheritedRules, "Allow: /", "");

  for (const group of parsed.groups) {
    const agents = group.agents.filter((a) => !blocked.has(a.toLowerCase()));
    if (agents.length === 0) continue;
    for (const agent of agents) lines.push(`User-agent: ${agent}`);
    lines.push(...(group.rules.length ? group.rules : ["Disallow:"]), "");
  }

  const sitemaps = parsed.sitemaps.length ? parsed.sitemaps : input.sitemapUrl ? [input.sitemapUrl] : [];
  for (const sitemap of sitemaps) lines.push(`Sitemap: ${sitemap}`);
  const suggestion = `${lines.join("\n").trim()}\n`;

  // Sanity check: every previously blocked bot must now be allowed at the root.
  const robot = robotsParser(`${origin}/robots.txt`, suggestion);
  const stillBlocked = blockedBots.filter((bot) => robot.isAllowed(`${origin}/`, bot) === false);
  if (stillBlocked.length) {
    console.warn("[site-fixes] robots.txt suggestion still blocks", stillBlocked);
    return null;
  }
  return suggestion;
}

/** Best-effort brand name: og:site_name, else the first segment of the homepage title, else the domain. */
export function guessSiteName(homepage: PageRecord | null, origin: string): string {
  if (homepage?.ogSiteName) return homepage.ogSiteName;
  const title = homepage?.title ?? "";
  const first = title.split(/\s+[|\-–—:·]\s+/)[0]?.trim();
  if (first && first.length >= 2 && first.length <= 60) return first;
  return new URL(origin).hostname.replace(/^www\./, "");
}

function escapeMarkdown(value: string): string {
  return value.replace(/([\[\]])/g, "\\$1");
}

/** Generates an llms.txt (https://llmstxt.org) from the crawled pages. */
export function buildLlmsTxt(input: {
  siteName: string;
  summary: string;
  pages: PageSummary[];
}): string {
  const lines = [`# ${input.siteName}`, ""];
  if (input.summary) lines.push(`> ${input.summary}`, "");
  const pages = input.pages.filter((p) => p.title || p.description).slice(0, 60);
  if (pages.length) {
    lines.push("## Pages", "");
    for (const page of pages) {
      const title = escapeMarkdown(page.title || new URL(page.url).pathname);
      lines.push(page.description ? `- [${title}](${page.url}): ${page.description}` : `- [${title}](${page.url})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

/** Organization + WebSite JSON-LD for the homepage. */
export function buildOrganizationJsonLd(input: { siteName: string; origin: string; description: string }): string {
  const homepage = `${input.origin}/`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${homepage}#organization`,
        name: input.siteName,
        url: homepage,
      },
      {
        "@type": "WebSite",
        "@id": `${homepage}#website`,
        name: input.siteName,
        url: homepage,
        ...(input.description ? { description: input.description } : {}),
        publisher: { "@id": `${homepage}#organization` },
      },
    ],
  };
  // Escape "<" so page text can never close the script tag.
  const json = JSON.stringify(data, null, 2).replace(/</g, "\\u003c");
  return `<script type="application/ld+json">\n${json}\n</script>`;
}
