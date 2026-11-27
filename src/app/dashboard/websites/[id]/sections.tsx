import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { CopyButton, DraftActions } from "@/components/dashboard/draft-actions";
import { CheckoutButton, ManageBillingButton, ResumePlanButton } from "@/components/dashboard/website-actions";
import Link from "next/link";
import { Badge, Card, CheckIcon, cn, EmptyState, Notice, ScoreRing, scoreColor, SeverityBadge } from "@/components/ui";
import { getDb } from "@/db";
import { drafts, issues, pages, type Audit, type Draft, type Website } from "@/db/schema";
import { aiEnabled } from "@/lib/aeo/ai-drafts";
import {
  AEO_CATEGORIES,
  AEO_CODES,
  GEO_CATEGORIES,
  GEO_CODES,
  issueInfo,
  passedLabel,
  SEO_CATEGORIES,
  SEO_CODES,
  SEVERITY_RANK,
} from "@/lib/aeo/issues";
import { aeoScore, geoScore, seoScore, type SeoIssueRow } from "@/lib/aeo/seo";
import type { CitedSource, VisibilityAction } from "@/lib/aeo/visibility";
import type { ReactNode } from "react";
import type { DraftField, Severity } from "@/lib/constants";
import { formatDate, formatDateTime, formatDuration } from "@/lib/format";

export function StatusBanner({ site, checkoutCancelled }: { site: Website; checkoutCancelled: boolean }) {
  switch (site.status) {
    case "pending_payment":
      return (
        <Notice
          tone="amber"
          title={checkoutCancelled ? "Checkout was cancelled" : "Complete checkout to start the automation"}
          action={<CheckoutButton websiteId={site.id} label="Complete checkout" />}
        >
          {checkoutCancelled
            ? "No payment was taken. Pick up where you left off whenever you're ready."
            : "If you just paid, this page updates automatically within a few seconds."}
        </Notice>
      );
    case "payment_failed":
      return (
        <Notice tone="red" title="Your payment didn't go through" action={<CheckoutButton websiteId={site.id} label="Try again" />}>
          No charge was made. Try again with the same or a different payment method.
        </Notice>
      );
    case "on_hold":
      return (
        <Notice tone="red" title="Automation paused: payment issue" action={<ManageBillingButton label="Update payment method" variant="primary" />}>
          The last renewal payment failed. Update your payment method to resume audits.
        </Notice>
      );
    case "past_due":
      return (
        <Notice tone="amber" title="Your renewal payment failed" action={<ManageBillingButton label="Update payment method" />}>
          Automation keeps running during the grace period. Update your payment method to avoid interruption.
        </Notice>
      );
    case "paused":
      return (
        <Notice tone="gray" title="Subscription paused" action={<ManageBillingButton label="Manage subscription" />}>
          Automation is paused until the subscription is resumed.
        </Notice>
      );
    case "cancelled":
    case "expired":
      return (
        <Notice tone="gray" title="This plan has ended" action={<CheckoutButton websiteId={site.id} label="Resubscribe" />}>
          Automation is stopped. Your audit history is kept, and resubscribing picks up where you left off.
        </Notice>
      );
    default:
      if (site.cancelAtPeriodEnd) {
        return (
          <Notice tone="amber" title={`Your plan ends on ${formatDate(site.nextBillingDate)}`} action={<ResumePlanButton websiteId={site.id} />}>
            Automation keeps running until then. Changed your mind? Keep your plan with one click.
          </Notice>
        );
      }
      return null;
  }
}

const SITE_FIX_META: Record<string, { title: string; where: string }> = {
  robots_txt: { title: "Corrected robots.txt", where: "Replace the file at" },
  llms_txt: { title: "llms.txt for AI assistants", where: "Upload as" },
  jsonld: { title: "Homepage schema markup (JSON-LD)", where: "Add to the <head> of" },
};
const SITE_FIELDS: DraftField[] = ["robots_txt", "llms_txt", "jsonld"];

function FieldRow({ draft, label }: { draft: Draft; label: string }) {
  const limit = draft.field === "title" ? 60 : 160;
  return (
    <div className="space-y-2 border-t border-ink-100 pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{label}</span>
        {draft.status === "approved" && <Badge tone="green">Applied</Badge>}
      </div>
      <p className="text-sm text-ink-500">
        <span className="font-medium text-ink-600">Current: </span>
        {draft.currentValue ? <span className="line-through decoration-rose-300">{draft.currentValue}</span> : <em>missing</em>}
      </p>
      <p className="text-sm text-ink-900">
        <span className="font-medium">Suggested: </span>
        {draft.proposed}{" "}
        <span className={cn("text-xs", draft.proposed.length > limit ? "text-amber-600" : "text-ink-400")}>
          ({draft.proposed.length} chars)
        </span>
      </p>
      <DraftActions draftId={draft.id} status={draft.status} copyText={draft.proposed} />
    </div>
  );
}

export async function FixesTab({ websiteId, hasCompletedAudit }: { websiteId: string; hasCompletedAudit: boolean }) {
  const rows = await getDb()
    .select()
    .from(drafts)
    .where(eq(drafts.websiteId, websiteId))
    .orderBy(desc(drafts.createdAt))
    .limit(500);

  const siteFixes = rows.filter((d) => SITE_FIELDS.includes(d.field) && d.status !== "rejected");
  const byUrl = new Map<string, { url: string; title?: Draft; description?: Draft }>();
  for (const draft of rows) {
    if (draft.field !== "title" && draft.field !== "description") continue;
    const group = byUrl.get(draft.url) ?? { url: draft.url };
    if (!group[draft.field]) group[draft.field] = draft; // Rows are newest first.
    byUrl.set(draft.url, group);
  }
  const pageGroups = [...byUrl.values()].filter(
    (g) => (g.title && g.title.status !== "rejected") || (g.description && g.description.status !== "rejected"),
  );
  const showAiNotice = !aiEnabled() && process.env.NODE_ENV !== "production";

  if (siteFixes.length === 0 && pageGroups.length === 0) {
    return (
      <div className="space-y-4">
        {showAiNotice && <AiDisabledNotice />}
        <EmptyState
          title={hasCompletedAudit ? "No fixes needed right now" : "Fixes will appear here"}
          description={
            hasCompletedAudit
              ? "Your latest audit didn't find anything we can write a fix for. Check the AEO, SEO and GEO tabs for content improvements."
              : "As soon as your first audit finishes, AI-written fixes for your site show up here."
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {showAiNotice && <AiDisabledNotice />}
      <p className="text-sm text-ink-600">
        Fixes are never published automatically. Copy each one into your site (or send it to your developer), then mark
        it as applied. The next audit confirms the change.
      </p>

      {siteFixes.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink-900">Site-wide fixes</h2>
          {siteFixes.map((fix) => (
            <Card key={fix.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-ink-900">{SITE_FIX_META[fix.field]?.title ?? fix.field}</h3>
                    {fix.status === "approved" && <Badge tone="green">Applied</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-ink-600">
                    {SITE_FIX_META[fix.field]?.where}{" "}
                    <a href={fix.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-aurora-600 break-all">
                      {fix.url}
                    </a>
                  </p>
                  {fix.rationale && <p className="mt-2 text-sm text-ink-600">{fix.rationale}</p>}
                </div>
              </div>
              <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-canvas p-4 text-xs leading-relaxed text-aurora-800 ring-1 ring-inset ring-ink-200">
                <code>{fix.proposed}</code>
              </pre>
              <div className="mt-4">
                <DraftActions draftId={fix.id} status={fix.status} copyText={fix.proposed} />
              </div>
            </Card>
          ))}
        </section>
      )}

      {pageGroups.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-ink-900">Page titles &amp; descriptions</h2>
          {pageGroups.map((group) => {
            const reviewNote = [group.title, group.description].find((d) => d?.needsReview);
            const rationale = group.title?.rationale ?? group.description?.rationale;
            return (
              <Card key={group.url} className="space-y-4 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <a href={group.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium break-all text-aurora-600">
                    {group.url}
                  </a>
                  {reviewNote && <Badge tone="amber">Review before publishing</Badge>}
                </div>
                {rationale && <p className="text-sm text-ink-600">{rationale}</p>}
                {group.title && group.title.status !== "rejected" && <FieldRow draft={group.title} label="Title" />}
                {group.description && group.description.status !== "rejected" && (
                  <FieldRow draft={group.description} label="Meta description" />
                )}
              </Card>
            );
          })}
        </section>
      )}
    </div>
  );
}

function AiDisabledNotice() {
  return (
    <Notice tone="amber" title="AI-written fixes are off (shown in development only)">
      Set ANTHROPIC_API_KEY or OPENAI_API_KEY to generate title and description fixes. robots.txt, llms.txt and schema fixes work without it.
    </Notice>
  );
}

interface IssueGroup {
  code: string;
  severity: Severity;
  count: number;
  examples: Array<{ url: string; detail: string | null }>;
}

const MAX_EXAMPLES = 6;

/** Site-wide fixes (generated during the audit) that resolve each issue. */
const SITE_FIX_FOR_CODE: Partial<Record<string, DraftField>> = {
  AI_BOT_BLOCKED: "robots_txt",
  AI_TRAINING_BOT_BLOCKED: "robots_txt",
  ROBOTS_MISSING: "robots_txt",
  SITEMAP_MISSING: "robots_txt",
  LLMS_TXT_MISSING: "llms_txt",
  SCHEMA_MISSING: "jsonld",
  GEO_ENTITY_MISSING: "jsonld",
  GEO_ENTITY_SAMEAS_MISSING: "jsonld",
};

/** Per-page AI drafts (title / meta description) that resolve each issue. */
const PAGE_FIX_FOR_CODE: Partial<Record<string, "title" | "description">> = {
  TITLE_MISSING: "title",
  TITLE_LENGTH: "title",
  SEO_DUPLICATE_TITLE: "title",
  DESCRIPTION_MISSING: "description",
  DESCRIPTION_LENGTH: "description",
  SEO_DUPLICATE_DESCRIPTION: "description",
};

interface FixLookup {
  site: Map<DraftField, Draft>;
  page: Map<string, Draft>;
}

const pageFixKey = (url: string, field: string) => `${field}:${url}`;

/** Latest non-rejected draft per site field and per page + field. */
async function loadFixes(websiteId: string): Promise<FixLookup> {
  const rows = await getDb()
    .select()
    .from(drafts)
    .where(and(eq(drafts.websiteId, websiteId), ne(drafts.status, "rejected")))
    .orderBy(desc(drafts.createdAt))
    .limit(1000);
  const lookup: FixLookup = { site: new Map(), page: new Map() };
  for (const draft of rows) {
    if (SITE_FIELDS.includes(draft.field)) {
      if (!lookup.site.has(draft.field)) lookup.site.set(draft.field, draft);
    } else {
      const key = pageFixKey(draft.url, draft.field);
      if (!lookup.page.has(key)) lookup.page.set(key, draft);
    }
  }
  return lookup;
}

type ChecksKind = "aeo" | "seo" | "geo";

const CHECKS: Record<
  ChecksKind,
  {
    title: string;
    intro: string;
    codes: Set<string>;
    categories: Array<{ id: string; label: string; codes: string[] }>;
    /** Scores the audit from its stored issues over this report's own checks. */
    compute: (pageUrls: string[], rows: SeoIssueRow[]) => number;
  }
> = {
  aeo: {
    title: "AEO score",
    intro:
      "Answer Engine Optimization: whether AI assistants like ChatGPT, Claude and Perplexity can reach your site and pull a direct answer from each page. It covers AI crawler access, answer-first content and structured data.",
    codes: AEO_CODES,
    categories: AEO_CATEGORIES,
    compute: aeoScore,
  },
  seo: {
    title: "SEO score",
    intro:
      "Search Engine Optimization: how well your site is set up for Google and other search engines. It covers crawling and indexing, titles and descriptions, images and links, security, speed and mobile.",
    codes: SEO_CODES,
    categories: SEO_CATEGORIES,
    compute: seoScore,
  },
  geo: {
    title: "GEO score",
    intro:
      "Generative Engine Optimization: how likely ChatGPT, Perplexity, Gemini and Google AI Overviews are to trust and cite your pages. It covers citation-worthy facts and sources, content that's easy to quote, and how clearly your brand is defined.",
    codes: GEO_CODES,
    categories: GEO_CATEGORIES,
    compute: geoScore,
  },
};

/** One report section (AEO, SEO or GEO): score, top fixes, then every check grouped by category. */
export async function ChecksTab({ kind, audit, websiteId }: { kind: ChecksKind; audit: Audit; websiteId: string }) {
  const config = CHECKS[kind];
  const db = getDb();
  const [pageRows, issueRows, fixes] = await Promise.all([
    db.select({ url: pages.url }).from(pages).where(eq(pages.auditId, audit.id)),
    db
      .select({ url: issues.url, code: issues.code, severity: issues.severity, detail: issues.detail })
      .from(issues)
      .where(and(eq(issues.auditId, audit.id), inArray(issues.code, [...config.codes])))
      .orderBy(issues.url),
    loadFixes(websiteId),
  ]);

  const score = config.compute(
    pageRows.map((p) => p.url),
    issueRows,
  );

  const groups = new Map<string, IssueGroup>();
  for (const row of issueRows) {
    const key = `${row.code}:${row.severity}`;
    const group = groups.get(key) ?? { code: row.code, severity: row.severity, count: 0, examples: [] };
    group.count++;
    if (group.examples.length < MAX_EXAMPLES) group.examples.push({ url: row.url, detail: row.detail });
    groups.set(key, group);
  }
  const sorted = [...groups.values()].sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.count - a.count || a.code.localeCompare(b.code),
  );
  const counts: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
  for (const g of sorted) counts[g.severity] += g.count;
  const failing = new Set(sorted.map((g) => g.code));
  const topFixes = sorted.slice(0, 3);
  const name = kind.toUpperCase();

  return (
    <div className="space-y-8">
      <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <ScoreRing score={score} size={88} />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold text-ink-900">{config.title}</h2>
          <p className="text-sm text-ink-600">{config.intro}</p>
          <p className="text-sm text-ink-500">
            {pageRows.length} pages checked · {counts.high} high · {counts.medium} medium · {counts.low} low priority ·{" "}
            <a href={`/api/audits/${audit.id}/export`} className="font-medium text-aurora-600 hover:text-aurora-500" download>
              Download CSV
            </a>
          </p>
        </div>
      </Card>

      {audit.seoScore === null && (
        <Notice tone="amber" title="This audit ran before the latest checks were added">
          Some {name} checks weren&apos;t run, so they may show as passed. Run a new audit to see every issue and fix.
        </Notice>
      )}

      {topFixes.length > 0 ? (
        <Card className="p-5">
          <h2 className="font-semibold text-ink-900">Fix these first</h2>
          <ol className="mt-3 space-y-2 text-sm text-ink-700">
            {topFixes.map((g, i) => {
              const info = issueInfo(g.code);
              return (
                <li key={`${g.code}-${g.severity}`} className="flex gap-3">
                  <span className="font-semibold text-aurora-600">{i + 1}.</span>
                  <span>
                    <a href={`#issue-${g.code}`} className="font-medium text-ink-900 hover:underline">
                      {info.title}
                    </a>
                    {info.scope === "page" && ` (${g.count} ${g.count === 1 ? "page" : "pages"})`}. {info.fix}
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      ) : (
        <EmptyState title={`No ${name} issues found`} description={`Your latest audit passed every ${name} check. Nice work!`} />
      )}

      {config.categories.map((category) => {
        const categoryGroups = sorted.filter((g) => category.codes.includes(g.code));
        const passed = category.codes.filter((code) => !failing.has(code));
        return (
          <section key={category.id} className="space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold text-ink-900">{category.label}</h2>
              <span className="text-sm text-ink-500">
                {passed.length} of {category.codes.length} checks passed
              </span>
            </div>
            {categoryGroups.map((group) => (
              <IssueCard key={`${group.code}-${group.severity}`} group={group} fixes={fixes} />
            ))}
            {passed.length > 0 && (
              <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-600">
                {passed.map((code) => (
                  <li key={code} className="flex items-center gap-1.5">
                    <CheckIcon className="shrink-0 text-emerald-500" />
                    {passedLabel(code)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}

      <p className="text-xs text-ink-500">
        Fixes are never published automatically. Copy them into your site (or send them to your developer), mark them
        as applied, then run a new audit to see your {name} score update.
      </p>
    </div>
  );
}

function IssueCard({ group, fixes }: { group: IssueGroup; fixes: FixLookup }) {
  const info = issueInfo(group.code);
  const siteField = SITE_FIX_FOR_CODE[group.code];
  const siteFix = siteField ? fixes.site.get(siteField) : undefined;
  const pageField = PAGE_FIX_FOR_CODE[group.code];
  return (
    <div id={`issue-${group.code}`} className="scroll-mt-6">
      <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={group.severity} />
        <h3 className="font-semibold text-ink-900">{info.title}</h3>
        <span className="text-sm text-ink-500">
          · {group.count} {info.scope === "site" ? (group.count === 1 ? "finding" : "findings") : group.count === 1 ? "page" : "pages"}
        </span>
      </div>
      {info.why && <p className="mt-2 text-sm text-ink-600">{info.why}</p>}
      {info.fix && (
        <p className="mt-2 text-sm text-ink-800">
          <span className="font-semibold">How to fix: </span>
          {info.fix}
        </p>
      )}

      {siteFix ? (
        <div className="mt-4 space-y-3 rounded-lg border border-aurora-200 bg-aurora-50/40 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-ink-900">Your fix: {SITE_FIX_META[siteFix.field]?.title ?? siteFix.field}</span>
            {siteFix.status === "approved" && <Badge tone="green">Applied</Badge>}
          </div>
          <p className="text-sm text-ink-600">
            {SITE_FIX_META[siteFix.field]?.where}{" "}
            <a href={siteFix.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium break-all text-aurora-600">
              {siteFix.url}
            </a>
          </p>
          <pre className="max-h-60 overflow-auto rounded-lg bg-canvas p-3 text-xs leading-relaxed text-aurora-800 ring-1 ring-inset ring-ink-200">
            <code>{siteFix.proposed}</code>
          </pre>
          <DraftActions draftId={siteFix.id} status={siteFix.status} copyText={siteFix.proposed} />
        </div>
      ) : (
        info.example && (
          <div className="mt-3 space-y-2">
            <pre className="max-h-60 overflow-auto rounded-lg bg-canvas p-3 text-xs leading-relaxed text-aurora-800 ring-1 ring-inset ring-ink-200">
              <code>{info.example}</code>
            </pre>
            <CopyButton text={info.example} label="Copy example" />
          </div>
        )
      )}

      <ul className="mt-4 space-y-3 text-sm">
        {group.examples.map((ex, index) => {
          const pageFix = pageField ? fixes.page.get(pageFixKey(ex.url, pageField)) : undefined;
          return (
            <li key={`${ex.url}-${index}`} className="space-y-2">
              <div className="flex flex-wrap gap-x-2 text-ink-600">
                <a href={ex.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-aurora-600 hover:underline">
                  {ex.url}
                </a>
                {ex.detail && <span className="text-ink-500">({ex.detail})</span>}
              </div>
              {pageFix && (
                <div className="ml-3 border-l-2 border-aurora-200 pl-3">
                  <FieldRow draft={pageFix} label={pageField === "title" ? "Title" : "Meta description"} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {group.count > group.examples.length && (
        <p className="mt-2 text-xs text-ink-500">+ {group.count - group.examples.length} more in the CSV export</p>
      )}
    </Card>
    </div>
  );
}

const ACTION_KIND_LABEL: Record<VisibilityAction["kind"], string> = {
  indexing: "Get indexed",
  content: "Content",
  offsite: "Off-site",
  brand: "Brand",
};
const PRIORITY_LABEL = { 1: "Do this week", 2: "Next", 3: "Later" } as const;

function CheckResult({ ok, title, children }: { ok: boolean; title: string; children: ReactNode }) {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2">
        <Badge tone={ok ? "green" : "red"}>{ok ? "Yes" : "No"}</Badge>
        <h3 className="font-semibold text-ink-900">{title}</h3>
      </div>
      <div className="mt-2 text-sm text-ink-600">{children}</div>
    </Card>
  );
}

function SourceLinks({ sources }: { sources: CitedSource[] }) {
  if (!sources.length) return <span className="text-ink-500">none</span>;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {sources.map((s) => (
        <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer nofollow" title={s.title} className="text-aurora-600 hover:underline">
          {s.domain}
        </a>
      ))}
    </span>
  );
}

/** Real-world visibility: what AI search actually says when customers ask, and what to do about it. */
export function VisibilityTab({ audit }: { audit: Audit }) {
  const v = audit.visibility;
  if (!v) {
    return (
      <Notice tone="amber" title="Real visibility wasn't measured for this audit">
        This audit ran before visibility checks were added. Run a new audit to see whether AI assistants and search
        actually find and cite your site, and what to do about it.
      </Notice>
    );
  }
  if (v.status !== "completed") {
    return (
      <Notice tone={v.status === "failed" ? "red" : "amber"} title="Real visibility couldn't be measured">
        {v.error ?? "Unknown error."} Your AEO, SEO and GEO results are unaffected.
      </Notice>
    );
  }

  const answered = v.questions.filter((q) => !q.error);
  const cited = answered.filter((q) => q.cited).length;
  const competitors = new Map<string, { source: CitedSource; count: number }>();
  for (const q of answered) {
    for (const s of q.citedInstead) {
      const entry = competitors.get(s.domain) ?? { source: s, count: 0 };
      entry.count++;
      competitors.set(s.domain, entry);
    }
  }
  const topCompetitors = [...competitors.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  return (
    <div className="space-y-8">
      <Card className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <ScoreRing score={v.score} size={88} />
        <div className="min-w-0 flex-1 space-y-1">
          <h2 className="text-lg font-semibold text-ink-900">Real visibility</h2>
          <p className="text-sm text-ink-600">
            We asked AI search (Claude with live web search) {answered.length} questions your customers ask, searched for
            your brand name, and checked whether AI already knows {v.brand}. This measures whether you&apos;re actually
            found. The AEO, SEO and GEO scores only check that your site is technically ready to be found.
          </p>
          <p className="text-sm text-ink-500">
            Cited in {cited} of {answered.length} answers · brand search {v.brandSearchFindsSite ? "finds" : "doesn't find"}{" "}
            your site · AI {v.aiKnowsBrand ? "knows" : "doesn't know"} your brand
          </p>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <CheckResult ok={cited > 0} title={`Cited for ${cited} of ${answered.length} customer questions`}>
          {cited === 0
            ? "AI assistants recommend other sites when your customers ask. See below who they cite instead."
            : "AI assistants cite you for some questions. Close the gaps on the rest."}
        </CheckResult>
        <CheckResult ok={v.brandSearchFindsSite} title={`Searching "${v.brand}" finds your site`}>
          {v.brandSearchFindsSite ? (
            "Search engines have indexed your site and connect it to your brand name."
          ) : (
            <>
              Even a search for your own name doesn&apos;t return your site, so search engines probably haven&apos;t
              indexed it. Results shown instead: <SourceLinks sources={v.brandSearchResults} />
            </>
          )}
        </CheckResult>
        <CheckResult ok={v.aiKnowsBrand} title="AI knows your brand without searching">
          {v.aiBrandSummary}
        </CheckResult>
      </div>

      {v.actions.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-900">Your action plan</h2>
          <p className="text-sm text-ink-600">
            Written from the answers above: the questions you lost, and the sites AI cited instead of you.
          </p>
          <ol className="space-y-3">
            {v.actions.map((action, i) => (
              <li key={i}>
                <Card className="p-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-aurora-600">{i + 1}.</span>
                    <h3 className="font-semibold text-ink-900">{action.title}</h3>
                    <Badge tone={action.priority === 1 ? "red" : action.priority === 2 ? "amber" : "gray"}>
                      {PRIORITY_LABEL[action.priority] ?? "Later"}
                    </Badge>
                    <Badge tone="indigo">{ACTION_KIND_LABEL[action.kind] ?? action.kind}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-ink-600">{action.why}</p>
                  <ul className="mt-3 space-y-1.5 text-sm text-ink-800">
                    {action.steps.map((step, j) => (
                      <li key={j} className="flex gap-2">
                        <CheckIcon className="mt-0.5 shrink-0 text-ink-400" />
                        <span>{step}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ol>
        </section>
      )}

      {topCompetitors.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-ink-900">Who AI recommends instead of you</h2>
          <Card className="p-5">
            <ul className="space-y-1.5 text-sm">
              {topCompetitors.map(({ source, count }) => (
                <li key={source.domain} className="flex flex-wrap justify-between gap-2">
                  <a href={source.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-aurora-600 hover:underline">
                    {source.domain}
                  </a>
                  <span className="text-ink-500">
                    cited in {count} of {answered.length} answers
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-ink-900">What AI answered</h2>
        {v.questions.map((q) => (
          <Card key={q.question} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              {q.error ? (
                <Badge tone="gray">Couldn&apos;t check</Badge>
              ) : q.cited ? (
                <Badge tone="green">You were cited</Badge>
              ) : q.inResults ? (
                <Badge tone="amber">Found, but not cited</Badge>
              ) : (
                <Badge tone="red">Not found</Badge>
              )}
              <h3 className="font-medium text-ink-900">&ldquo;{q.question}&rdquo;</h3>
            </div>
            {q.error ? (
              <p className="mt-2 text-sm text-ink-500">{q.error}</p>
            ) : (
              <>
                <p className="mt-2 text-sm text-ink-600">
                  <span className="font-medium text-ink-700">Cited instead: </span>
                  <SourceLinks sources={q.citedInstead} />
                </p>
                {q.answer && (
                  <details className="mt-2 text-sm text-ink-600">
                    <summary className="cursor-pointer text-ink-500 hover:text-ink-700">Read the AI&apos;s answer</summary>
                    <p className="mt-2 whitespace-pre-line">{q.answer}</p>
                  </details>
                )}
              </>
            )}
          </Card>
        ))}
      </section>

      <p className="text-xs text-ink-500">
        Checked {formatDateTime(new Date(v.checkedAt))}. AI answers vary between runs and assistants, so track the trend
        across audits rather than any single answer.
      </p>
    </div>
  );
}

const SCORE_KINDS: ChecksKind[] = ["aeo", "seo", "geo"];

async function auditFindings(auditId: string): Promise<{ pageUrls: string[]; issues: SeoIssueRow[] }> {
  const db = getDb();
  const [pageRows, issueRows] = await Promise.all([
    db.select({ url: pages.url }).from(pages).where(eq(pages.auditId, auditId)),
    db.select({ url: issues.url, code: issues.code, severity: issues.severity }).from(issues).where(eq(issues.auditId, auditId)),
  ]);
  return { pageUrls: pageRows.map((p) => p.url), issues: issueRows };
}

/** AEO, SEO and GEO scores for the latest audit, each with its change and issue count, linking to its tab. */
export async function ScoreCards({ audit, previous, websiteId }: { audit: Audit; previous?: Audit; websiteId: string }) {
  const [current, prior] = await Promise.all([auditFindings(audit.id), previous ? auditFindings(previous.id) : null]);
  // Audits from before the SEO/GEO checks existed (no saved SEO score) can't be compared for those reports.
  const priorHasAllChecks = previous?.seoScore !== null && previous?.seoScore !== undefined;

  const v = audit.visibility?.status === "completed" ? audit.visibility : null;
  const visibilityDelta = v && previous?.visibilityScore != null ? v.score - previous.visibilityScore : null;
  const answered = v ? v.questions.filter((q) => !q.error) : [];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Link
        href={`/dashboard/websites/${websiteId}?tab=visibility`}
        scroll={false}
        className="group rounded-xl focus-visible:outline-2 focus-visible:outline-aurora-500"
      >
        <Card className="flex h-full items-center gap-4 p-5 ring-aurora-500 transition group-hover:ring-aurora-400">
          <ScoreRing score={v ? v.score : null} size={72} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-ink-700">Real visibility</p>
            {v ? (
              visibilityDelta !== null ? (
                <p className="text-sm font-semibold" style={{ color: visibilityDelta >= 0 ? scoreColor(100) : scoreColor(0) }}>
                  {visibilityDelta >= 0 ? `+${visibilityDelta}` : visibilityDelta} since last audit
                </p>
              ) : (
                <p className="text-sm text-ink-500">Measured with AI search</p>
              )
            ) : (
              <p className="text-sm text-ink-500">Not measured yet</p>
            )}
            <p className="mt-0.5 text-xs text-ink-500">
              {v ? `Cited in ${answered.filter((q) => q.cited).length} of ${answered.length} AI answers · ` : ""}
              <span className="text-aurora-600 group-hover:underline">{v ? "See action plan →" : "Details →"}</span>
            </p>
          </div>
        </Card>
      </Link>
      {SCORE_KINDS.map((kind) => {
        const config = CHECKS[kind];
        const rows = current.issues.filter((r) => config.codes.has(r.code));
        const score = config.compute(current.pageUrls, rows);
        const comparable = prior && (kind === "aeo" || priorHasAllChecks);
        const delta = comparable ? score - config.compute(prior.pageUrls, prior.issues) : null;
        const high = rows.filter((r) => r.severity === "high").length;
        return (
          <Link
            key={kind}
            href={`/dashboard/websites/${websiteId}?tab=${kind}`}
            scroll={false}
            className="group rounded-xl focus-visible:outline-2 focus-visible:outline-aurora-500"
          >
            <Card className="flex h-full items-center gap-4 p-5 transition group-hover:ring-aurora-400">
              <ScoreRing score={score} size={72} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-ink-700">
                  {config.title} <span className="font-normal text-ink-500">· technical</span>
                </p>
                {delta !== null ? (
                  <p className="text-sm font-semibold" style={{ color: delta >= 0 ? scoreColor(100) : scoreColor(0) }}>
                    {delta >= 0 ? `+${delta}` : delta} since last audit
                  </p>
                ) : (
                  <p className="text-sm text-ink-500">{previous ? "New score" : "First audit"}</p>
                )}
                <p className="mt-0.5 text-xs text-ink-500">
                  {rows.length} {rows.length === 1 ? "issue" : "issues"}
                  {high > 0 && ` · ${high} high`} · <span className="text-aurora-600 group-hover:underline">View fixes →</span>
                </p>
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

export async function PagesTab({ auditId }: { auditId: string }) {
  const rows = await getDb()
    .select({
      id: pages.id,
      url: pages.url,
      statusCode: pages.statusCode,
      title: pages.title,
      words: pages.words,
      score: pages.score,
      issueCount: pages.issueCount,
      schemaTypes: pages.schemaTypes,
    })
    .from(pages)
    .where(eq(pages.auditId, auditId))
    .orderBy(sql`${pages.score} asc nulls first`, desc(pages.issueCount))
    .limit(300);

  if (rows.length === 0) return <EmptyState title="No pages yet" description="Pages appear here once an audit has crawled your site." />;

  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-ink-200 bg-ink-50 text-xs text-ink-500 uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Page</th>
            <th scope="col" className="px-4 py-3 font-medium">Score</th>
            <th scope="col" className="px-4 py-3 font-medium">Issues</th>
            <th scope="col" className="px-4 py-3 font-medium">Words</th>
            <th scope="col" className="px-4 py-3 font-medium">Schema</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="max-w-md px-4 py-3">
                <a href={row.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium break-all text-aurora-600 hover:underline">
                  {row.url}
                </a>
                <p className="mt-0.5 truncate text-xs text-ink-500">
                  {row.statusCode && row.statusCode >= 400 ? `HTTP ${row.statusCode}` : row.statusCode === 0 ? "Could not load" : row.title || "(no title)"}
                </p>
              </td>
              <td className="px-4 py-3 font-semibold text-ink-900">{row.score ?? "-"}</td>
              <td className="px-4 py-3 text-ink-700">{row.issueCount}</td>
              <td className="px-4 py-3 text-ink-700">{row.words ?? "-"}</td>
              <td className="px-4 py-3 text-xs text-ink-500">{row.schemaTypes || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const TRIGGER_LABEL: Record<string, string> = { initial: "First audit", scheduled: "Automatic", manual: "On demand" };

export function HistoryTab({ audits }: { audits: Audit[] }) {
  if (audits.length === 0) return <EmptyState title="No audits yet" description="Your audit history will appear here." />;
  return (
    <Card className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-ink-200 bg-ink-50 text-xs text-ink-500 uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Started</th>
            <th scope="col" className="px-4 py-3 font-medium">Type</th>
            <th scope="col" className="px-4 py-3 font-medium">Status</th>
            <th scope="col" className="px-4 py-3 font-medium">Score</th>
            <th scope="col" className="px-4 py-3 font-medium">Pages</th>
            <th scope="col" className="px-4 py-3 font-medium">Issues</th>
            <th scope="col" className="px-4 py-3 font-medium">Duration</th>
            <th scope="col" className="px-4 py-3 font-medium"><span className="sr-only">Export</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {audits.map((audit) => (
            <tr key={audit.id}>
              <td className="px-4 py-3 whitespace-nowrap text-ink-700">{formatDateTime(audit.startedAt ?? audit.queuedAt)}</td>
              <td className="px-4 py-3 text-ink-700">{TRIGGER_LABEL[audit.trigger] ?? audit.trigger}</td>
              <td className="px-4 py-3">
                <Badge
                  tone={
                    audit.status === "completed" ? "green" : audit.status === "failed" ? "red" : audit.status === "cancelled" ? "gray" : "indigo"
                  }
                >
                  {audit.status}
                </Badge>
                {audit.error && audit.status === "failed" && <p className="mt-1 max-w-xs text-xs text-rose-600">{audit.error}</p>}
              </td>
              <td className="px-4 py-3 font-semibold text-ink-900">{audit.score ?? "-"}</td>
              <td className="px-4 py-3 text-ink-700">{audit.pagesCrawled}</td>
              <td className="px-4 py-3 text-ink-700">{audit.issuesHigh + audit.issuesMedium + audit.issuesLow}</td>
              <td className="px-4 py-3 text-ink-700">{formatDuration(audit.startedAt, audit.finishedAt)}</td>
              <td className="px-4 py-3 text-right">
                {audit.status === "completed" && (
                  <a href={`/api/audits/${audit.id}/export`} download className="text-xs font-medium text-aurora-600 hover:underline">
                    CSV
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
