import type { Severity } from "../constants";
import { AEO_CODES, GEO_CODES, INFORMATIONAL_CODES, issueInfo, SEO_CODES } from "./issues";
import { overallScore, scorePage, scoreSite } from "./score";

export interface SeoIssueRow {
  url: string;
  code: string;
  severity: Severity;
}

/**
 * Score for an audit over a subset of checks, computed from its stored issues with the same
 * weighting as the AEO score (75% average page health, 25% site-wide checks).
 */
export function checksScore(pageUrls: string[], rows: SeoIssueRow[], codes: Set<string>): number {
  const byPage = new Map<string, SeoIssueRow[]>(pageUrls.map((url) => [url, []]));
  const siteIssues: SeoIssueRow[] = [];
  for (const row of rows) {
    if (!codes.has(row.code) || INFORMATIONAL_CODES.has(row.code)) continue;
    if (issueInfo(row.code).scope === "site") {
      siteIssues.push(row);
    } else {
      const list = byPage.get(row.url) ?? [];
      list.push(row);
      byPage.set(row.url, list);
    }
  }
  const pageScores = [...byPage.values()].map((issues) => scorePage(issues));
  return overallScore(pageScores, scoreSite(siteIssues));
}

/** AEO score: AI answer engine checks only (matches the score saved by the audit). */
export function aeoScore(pageUrls: string[], rows: SeoIssueRow[]): number {
  return checksScore(pageUrls, rows, AEO_CODES);
}

/** SEO score: classic search engine checks only. */
export function seoScore(pageUrls: string[], rows: SeoIssueRow[]): number {
  return checksScore(pageUrls, rows, SEO_CODES);
}

/** GEO score: how likely generative engines (ChatGPT, Perplexity, AI Overviews) are to cite the site. */
export function geoScore(pageUrls: string[], rows: SeoIssueRow[]): number {
  return checksScore(pageUrls, rows, GEO_CODES);
}
