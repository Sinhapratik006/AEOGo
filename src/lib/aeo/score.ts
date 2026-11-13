import type { Severity } from "../constants";

const PAGE_PENALTY: Record<Severity, number> = { high: 20, medium: 8, low: 3 };
const SITE_PENALTY: Record<Severity, number> = { high: 25, medium: 10, low: 4 };
const RANK: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

interface ScoredIssue {
  code: string;
  severity: Severity;
}

/** Each distinct issue code counts once, at its worst severity. */
function worstSeverityByCode(issues: ScoredIssue[]): Severity[] {
  const worst = new Map<string, Severity>();
  for (const issue of issues) {
    const current = worst.get(issue.code);
    if (!current || RANK[issue.severity] > RANK[current]) worst.set(issue.code, issue.severity);
  }
  return [...worst.values()];
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function scorePage(issues: ScoredIssue[]): number {
  return clamp(100 - worstSeverityByCode(issues).reduce((sum, s) => sum + PAGE_PENALTY[s], 0));
}

export function scoreSite(siteIssues: ScoredIssue[]): number {
  return clamp(100 - worstSeverityByCode(siteIssues).reduce((sum, s) => sum + SITE_PENALTY[s], 0));
}

/** Overall AEO score: 75% average page health, 25% site-level access and discovery. */
export function overallScore(pageScores: number[], siteScore: number): number {
  if (pageScores.length === 0) return clamp(siteScore * 0.25);
  const average = pageScores.reduce((a, b) => a + b, 0) / pageScores.length;
  return clamp(average * 0.75 + siteScore * 0.25);
}
