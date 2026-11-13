import { and, eq, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { audits, drafts, issues, pages, users, websites, type Website } from "@/db/schema";
import { isAutomationStatus, type DraftField, type Severity } from "../constants";
import { auditReadyEmail, sendEmailSafely } from "../email";
import { envInt } from "../env";
import { PLANS, type Plan } from "../plans";
import { AiAuthError, aiEnabled, draftMetadata } from "./ai-drafts";
import type { IssueInput } from "./analyze";
import { crawlSite, type CrawlResult } from "./crawl";
import { INFORMATIONAL_CODES } from "./issues";
import { overallScore, scorePage, scoreSite } from "./score";
import { buildLlmsTxt, buildOrganizationJsonLd, buildRobotsTxtSuggestion, guessSiteName } from "./site-fixes";

const HEARTBEAT_INTERVAL_MS = 5_000;
const FAILURE_RETRY_HOURS = 6;
const SITE_FIX_FIELDS: DraftField[] = ["robots_txt", "llms_txt", "jsonld"];

type Beat = (pagesCrawled: number, message: string, force?: boolean) => Promise<boolean>;

function clip(value: string | null | undefined, max: number): string | null {
  if (value === null || value === undefined) return null;
  return value.length > max ? value.slice(0, max) : value;
}

async function runPool<T>(items: T[], concurrency: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next++];
      await fn(item);
    }
  });
  await Promise.all(workers);
}

async function failAudit(auditId: string, websiteId: string, message: string, extra: Partial<typeof audits.$inferInsert> = {}) {
  const db = getDb();
  const now = new Date();
  await db
    .update(audits)
    .set({ ...extra, status: "failed", finishedAt: now, progress: null, error: message.slice(0, 1000) })
    .where(eq(audits.id, auditId));
  // Retry sooner than the normal schedule.
  await db
    .update(websites)
    .set({ nextAuditAt: new Date(now.getTime() + FAILURE_RETRY_HOURS * 3_600_000), updatedAt: now })
    .where(eq(websites.id, websiteId));
}

/** Runs one claimed audit end to end. Never throws. */
export async function runAudit(auditId: string): Promise<void> {
  const db = getDb();
  const [row] = await db
    .select({ website: websites })
    .from(audits)
    .innerJoin(websites, eq(websites.id, audits.websiteId))
    .where(eq(audits.id, auditId));
  if (!row) return;
  try {
    await executeAudit(auditId, row.website);
  } catch (err) {
    const [stillExists] = await db
      .select({ id: audits.id })
      .from(audits)
      .where(eq(audits.id, auditId))
      .catch(() => [{ id: auditId }]);
    if (!stillExists) {
      console.info(`[audit ${auditId}] stopped: the website was removed while the audit was running`);
      return;
    }
    console.error(`[audit ${auditId}] failed`, err);
    await failAudit(auditId, row.website.id, err instanceof Error ? err.message : String(err)).catch((e) =>
      console.error(`[audit ${auditId}] could not record failure`, e),
    );
  }
}

async function executeAudit(auditId: string, website: Website): Promise<void> {
  const db = getDb();
  if (!isAutomationStatus(website.status)) {
    await db
      .update(audits)
      .set({ status: "cancelled", finishedAt: new Date(), progress: null, error: "Subscription is not active" })
      .where(eq(audits.id, auditId));
    return;
  }
  const plan = PLANS[website.plan] ?? PLANS.starter;

  // A retried audit starts from scratch so interrupted runs never leave duplicates.
  await db.delete(pages).where(eq(pages.auditId, auditId));
  await db.delete(issues).where(eq(issues.auditId, auditId));

  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  const pageScores: number[] = [];
  let lastBeat = 0;
  let stopped = false;

  const beat: Beat = async (pagesCrawled, message, force = false) => {
    if (stopped) return false;
    if (!force && Date.now() - lastBeat < HEARTBEAT_INTERVAL_MS) return true;
    lastBeat = Date.now();
    const updated = await db
      .update(audits)
      .set({ heartbeatAt: new Date(), progress: message, pagesCrawled })
      .where(and(eq(audits.id, auditId), eq(audits.status, "running")))
      .returning({ id: audits.id });
    const [current] = await db.select({ status: websites.status }).from(websites).where(eq(websites.id, website.id));
    if (updated.length === 0 || !current || !isAutomationStatus(current.status)) stopped = true;
    return !stopped;
  };

  const crawl = await crawlSite(
    website.url,
    {
      maxPages: plan.maxPages,
      delayMs: envInt("CRAWL_DELAY_MS", 500),
      timeBudgetMs: envInt("CRAWL_TIME_BUDGET_MINUTES", 45) * 60_000,
    },
    {
      onProgress: (pagesCrawled, message) => beat(pagesCrawled, message),
      onPage: async ({ record, issues: pageIssues }) => {
        const score = scorePage(pageIssues.filter((i) => !INFORMATIONAL_CODES.has(i.code)));
        pageScores.push(score);
        for (const issue of pageIssues) counts[issue.severity]++;
        await db.transaction(async (tx) => {
          await tx.insert(pages).values({
            auditId,
            url: clip(record.url, 2048) as string,
            statusCode: record.statusCode,
            title: clip(record.title, 1000),
            description: clip(record.description, 2000),
            h1Count: record.h1Count,
            words: record.words,
            schemaTypes: clip(record.schemaTypes.join(","), 1000),
            issueCount: pageIssues.length,
            score,
            textExcerpt: record.textExcerpt,
          });
          if (pageIssues.length) await tx.insert(issues).values(pageIssues.map((i) => toIssueRow(auditId, i)));
        });
      },
    },
  );

  if (stopped || crawl.aborted) {
    await db
      .update(audits)
      .set({ status: "cancelled", finishedAt: new Date(), progress: null, error: "Stopped: the subscription is no longer active" })
      .where(eq(audits.id, auditId));
    return;
  }

  if (crawl.siteIssues.length) await db.insert(issues).values(crawl.siteIssues.map((i) => toIssueRow(auditId, i)));
  const scoredSiteIssues = crawl.siteIssues.filter((i) => !INFORMATIONAL_CODES.has(i.code));
  for (const issue of scoredSiteIssues) counts[issue.severity]++;

  if (!crawl.ok) {
    await failAudit(auditId, website.id, crawl.fatalError ?? "The crawl failed", {
      pagesCrawled: crawl.pagesCrawled,
      issuesHigh: counts.high,
      issuesMedium: counts.medium,
      issuesLow: counts.low,
    });
    return;
  }

  const score = overallScore(pageScores, scoreSite(scoredSiteIssues));
  await beat(crawl.pagesCrawled, "Writing your fixes", true);
  const draftsCreated = (await writeSiteFixes(auditId, website, crawl)) + (await writeMetaDrafts(auditId, website, plan, crawl, beat));

  const finishedAt = new Date();
  const completed = await db.transaction(async (tx) => {
    const updated = await tx
      .update(audits)
      .set({
        status: "completed",
        finishedAt,
        progress: null,
        error: null,
        pagesCrawled: crawl.pagesCrawled,
        issuesHigh: counts.high,
        issuesMedium: counts.medium,
        issuesLow: counts.low,
        draftsCreated,
        score,
      })
      .where(and(eq(audits.id, auditId), eq(audits.status, "running")))
      .returning({ id: audits.id });
    if (updated.length === 0) return false;
    await tx
      .update(websites)
      .set({
        latestScore: score,
        lastAuditAt: finishedAt,
        nextAuditAt: new Date(finishedAt.getTime() + plan.auditIntervalHours * 3_600_000),
        updatedAt: finishedAt,
      })
      .where(eq(websites.id, website.id));
    return true;
  });

  if (completed && !website.lastAuditAt) {
    const [owner] = await db.select({ email: users.email, name: users.name }).from(users).where(eq(users.id, website.userId));
    if (owner) {
      const issueCount = counts.high + counts.medium + counts.low;
      await sendEmailSafely(
        auditReadyEmail(owner.email, owner.name, website.domain, website.id, score, crawl.pagesCrawled, issueCount),
      );
    }
  }
}

function toIssueRow(auditId: string, issue: IssueInput) {
  return {
    auditId,
    url: clip(issue.url, 2048) as string,
    code: issue.code,
    severity: issue.severity,
    detail: clip(issue.detail, 1000),
  };
}

/** robots.txt, llms.txt and homepage JSON-LD suggestions. Returns the number of fixes written. */
async function writeSiteFixes(auditId: string, website: Website, crawl: CrawlResult): Promise<number> {
  const db = getDb();
  const origin = crawl.origin;
  const siteName = guessSiteName(crawl.homepage, origin);
  const fixes: Array<{ field: DraftField; url: string; proposed: string; currentValue: string | null; rationale: string }> = [];

  if (crawl.robots) {
    const robots = crawl.robots;
    const suggestion = buildRobotsTxtSuggestion({
      origin,
      currentContent: robots.content,
      exists: robots.exists,
      blockedBots: robots.blockedAnswerBots,
      sitemapUrl: crawl.sitemapFound ? (robots.sitemaps[0] ?? `${origin}/sitemap.xml`) : null,
    });
    if (suggestion) {
      fixes.push({
        field: "robots_txt",
        url: `${origin}/robots.txt`,
        proposed: suggestion,
        currentValue: robots.exists ? robots.content.slice(0, 20_000) : null,
        rationale: robots.exists
          ? `Lets ${robots.blockedAnswerBots.join(", ")} read your site so AI answer engines can cite it, while keeping your other rules.`
          : "Adds a robots.txt that allows crawlers and points them to your sitemap. Upload it to the root of your site.",
      });
    }
  }

  if (!crawl.llmsTxtExists && crawl.pages.length > 0) {
    fixes.push({
      field: "llms_txt",
      url: `${origin}/llms.txt`,
      proposed: buildLlmsTxt({ siteName, summary: crawl.homepage?.description ?? "", pages: crawl.pages }),
      currentValue: null,
      rationale: "Upload this file to the root of your site as /llms.txt so AI assistants get a curated map of your key pages.",
    });
  }

  if (crawl.homepage && crawl.homepage.schemaTypes.length === 0) {
    fixes.push({
      field: "jsonld",
      url: crawl.homepage.url,
      proposed: buildOrganizationJsonLd({ siteName, origin, description: crawl.homepage.description }),
      currentValue: null,
      rationale: `Paste this into the <head> of your homepage so AI engines know who you are. Check that "${siteName}" is your official name.`,
    });
  }

  // Unreviewed suggestions for problems that are now fixed are stale.
  const fixedFields = SITE_FIX_FIELDS.filter((field) => !fixes.some((f) => f.field === field));
  if (fixedFields.length) {
    await db
      .delete(drafts)
      .where(and(eq(drafts.websiteId, website.id), inArray(drafts.field, fixedFields), eq(drafts.status, "draft")));
  }

  let created = 0;
  for (const fix of fixes) {
    const [alreadyApproved] = await db
      .select({ id: drafts.id })
      .from(drafts)
      .where(
        and(
          eq(drafts.websiteId, website.id),
          eq(drafts.field, fix.field),
          eq(drafts.status, "approved"),
          eq(drafts.proposed, fix.proposed),
        ),
      )
      .limit(1);
    if (alreadyApproved) continue;
    await db.transaction(async (tx) => {
      await tx
        .delete(drafts)
        .where(and(eq(drafts.websiteId, website.id), eq(drafts.field, fix.field), eq(drafts.status, "draft")));
      await tx.insert(drafts).values({ websiteId: website.id, auditId, status: "draft", ...fix });
    });
    created++;
  }
  return created;
}

/** AI-written titles and descriptions for pages with metadata issues. Returns the number of pages drafted. */
async function writeMetaDrafts(auditId: string, website: Website, plan: Plan, crawl: CrawlResult, beat: Beat): Promise<number> {
  if (!aiEnabled() || plan.aiDraftsPerAudit <= 0) return 0;
  const db = getDb();

  const candidates = await db.execute<{
    url: string;
    title: string | null;
    description: string | null;
    text: string | null;
  }>(sql`
    select p.url, p.title, p.description, p.text_excerpt as text
    from pages p
    join issues i on i.audit_id = p.audit_id and i.url = p.url
    where p.audit_id = ${auditId}
      and p.status_code between 200 and 399
      and coalesce(p.words, 0) >= 30
      and i.code in ('TITLE_MISSING', 'TITLE_LENGTH', 'DESCRIPTION_MISSING', 'DESCRIPTION_LENGTH')
    group by p.id
    order by min(case i.severity when 'high' then 0 when 'medium' then 1 else 2 end), p.id
    limit ${plan.aiDraftsPerAudit * 3}
  `);
  if (candidates.rows.length === 0) return 0;

  // Skip pages whose title and description haven't changed since we last drafted them.
  const urls = candidates.rows.map((r) => r.url);
  const existing = await db
    .select({ url: drafts.url, field: drafts.field, currentValue: drafts.currentValue })
    .from(drafts)
    .where(and(eq(drafts.websiteId, website.id), inArray(drafts.url, urls), inArray(drafts.field, ["title", "description"])));
  const drafted = new Set(existing.map((d) => `${d.url}\u0000${d.field}\u0000${d.currentValue ?? ""}`));
  const todo = candidates.rows
    .filter(
      (p) =>
        !(
          drafted.has(`${p.url}\u0000title\u0000${p.title ?? ""}`) &&
          drafted.has(`${p.url}\u0000description\u0000${p.description ?? ""}`)
        ),
    )
    .slice(0, plan.aiDraftsPerAudit);

  let created = 0;
  let consecutiveErrors = 0;
  let stop = false;
  await runPool(todo, 3, async (page) => {
    if (stop) return;
    try {
      const draft = await draftMetadata({
        url: page.url,
        title: page.title ?? "",
        description: page.description ?? "",
        text: page.text ?? "",
      });
      consecutiveErrors = 0;
      const needsReview = draft.unsupportedClaims.length > 0;
      const rationale = needsReview
        ? `${draft.rationale} Review before publishing: may contain unsupported claims (${draft.unsupportedClaims.join("; ")}).`
        : draft.rationale;
      await db.transaction(async (tx) => {
        await tx
          .delete(drafts)
          .where(
            and(
              eq(drafts.websiteId, website.id),
              eq(drafts.url, page.url),
              inArray(drafts.field, ["title", "description"]),
              eq(drafts.status, "draft"),
            ),
          );
        await tx.insert(drafts).values([
          {
            websiteId: website.id,
            auditId,
            url: page.url,
            field: "title",
            currentValue: page.title || null,
            proposed: draft.title,
            rationale,
            needsReview,
          },
          {
            websiteId: website.id,
            auditId,
            url: page.url,
            field: "description",
            currentValue: page.description || null,
            proposed: draft.description,
            rationale,
            needsReview,
          },
        ]);
      });
      created++;
      if (!(await beat(crawl.pagesCrawled, `Writing AI fixes (${created}/${todo.length})`))) stop = true;
    } catch (err) {
      if (err instanceof AiAuthError) {
        console.error("[audit] Anthropic rejected the API key; skipping AI fixes. Check ANTHROPIC_API_KEY.");
        stop = true;
        return;
      }
      consecutiveErrors++;
      console.warn(`[audit ${auditId}] AI draft failed for ${page.url}:`, (err as Error).message);
      if (consecutiveErrors >= 5) stop = true;
    }
  });
  return created;
}
