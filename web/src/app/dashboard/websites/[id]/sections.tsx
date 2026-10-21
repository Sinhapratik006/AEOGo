import { desc, eq, sql } from "drizzle-orm";
import { DraftActions } from "@/components/dashboard/draft-actions";
import { CheckoutButton, ManageBillingButton, ResumePlanButton } from "@/components/dashboard/website-actions";
import { Badge, Card, cn, EmptyState, Notice, SeverityBadge } from "@/components/ui";
import { getDb } from "@/db";
import { drafts, pages, type Audit, type Draft, type Website } from "@/db/schema";
import { aiEnabled } from "@/lib/aeo/ai-drafts";
import { issueInfo } from "@/lib/aeo/issues";
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

export function AuditProgress({ audit }: { audit: Audit }) {
  return (
    <Card className="overflow-hidden">
      <div className="h-1 w-full overflow-hidden bg-indigo-100">
        <div className="h-full w-1/3 animate-[pulse_1.5s_ease-in-out_infinite] bg-indigo-500" />
      </div>
      <div className="flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold text-slate-900">
            {audit.status === "queued" ? "Audit queued" : "Audit in progress"}
            {audit.trigger === "initial" && " · your first report"}
          </p>
          <p className="text-sm text-slate-600">
            {audit.status === "queued" ? "Waiting for a crawler to pick it up…" : audit.progress ?? "Working…"}
          </p>
        </div>
        <p className="text-sm text-slate-500">{audit.pagesCrawled} pages crawled</p>
      </div>
    </Card>
  );
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
    <div className="space-y-2 border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</span>
        {draft.status === "approved" && <Badge tone="green">Applied</Badge>}
      </div>
      <p className="text-sm text-slate-500">
        <span className="font-medium text-slate-600">Current: </span>
        {draft.currentValue ? <span className="line-through decoration-rose-300">{draft.currentValue}</span> : <em>missing</em>}
      </p>
      <p className="text-sm text-slate-900">
        <span className="font-medium">Suggested: </span>
        {draft.proposed}{" "}
        <span className={cn("text-xs", draft.proposed.length > limit ? "text-amber-600" : "text-slate-400")}>
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
              ? "Your latest audit didn't find anything we can write a fix for. Check the Issues tab for content improvements."
              : "As soon as your first audit finishes, AI-written fixes for your site show up here."
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {showAiNotice && <AiDisabledNotice />}
      <p className="text-sm text-slate-600">
        Fixes are never published automatically. Copy each one into your site (or send it to your developer), then mark
        it as applied. The next audit confirms the change.
      </p>

      {siteFixes.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Site-wide fixes</h2>
          {siteFixes.map((fix) => (
            <Card key={fix.id} className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{SITE_FIX_META[fix.field]?.title ?? fix.field}</h3>
                    {fix.status === "approved" && <Badge tone="green">Applied</Badge>}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {SITE_FIX_META[fix.field]?.where}{" "}
                    <a href={fix.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-indigo-600 break-all">
                      {fix.url}
                    </a>
                  </p>
                  {fix.rationale && <p className="mt-2 text-sm text-slate-600">{fix.rationale}</p>}
                </div>
              </div>
              <pre className="mt-4 max-h-80 overflow-auto rounded-lg bg-slate-900 p-4 text-xs leading-relaxed text-slate-100">
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
          <h2 className="text-lg font-semibold text-slate-900">Page titles &amp; descriptions</h2>
          {pageGroups.map((group) => {
            const reviewNote = [group.title, group.description].find((d) => d?.needsReview);
            const rationale = group.title?.rationale ?? group.description?.rationale;
            return (
              <Card key={group.url} className="space-y-4 p-5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <a href={group.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium break-all text-indigo-600">
                    {group.url}
                  </a>
                  {reviewNote && <Badge tone="amber">Review before publishing</Badge>}
                </div>
                {rationale && <p className="text-sm text-slate-600">{rationale}</p>}
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
      Set ANTHROPIC_API_KEY to generate title and description fixes. robots.txt, llms.txt and schema fixes work without it.
    </Notice>
  );
}

export async function IssuesTab({ auditId }: { auditId: string }) {
  const result = await getDb().execute<{
    code: string;
    severity: Severity;
    count: number;
    urls: string[];
    details: string[];
  }>(sql`
    select code, severity, count(*)::int as count,
      (array_agg(url order by url))[1:6] as urls,
      (array_agg(coalesce(detail, '') order by url))[1:6] as details
    from issues
    where audit_id = ${auditId}
    group by code, severity
    order by case severity when 'high' then 0 when 'medium' then 1 else 2 end, count(*) desc, code
  `);
  const groups = result.rows;

  if (groups.length === 0) {
    return <EmptyState title="No issues found" description="Your latest audit didn't find any problems. Nice work!" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <a href={`/api/audits/${auditId}/export`} className="text-sm font-medium text-indigo-600 hover:text-indigo-500" download>
          Download all issues (CSV)
        </a>
      </div>
      {groups.map((group) => {
        const info = issueInfo(group.code);
        return (
          <Card key={`${group.code}-${group.severity}`} className="p-5">
            <div className="flex flex-wrap items-center gap-2">
              <SeverityBadge severity={group.severity} />
              <h3 className="font-semibold text-slate-900">{info.title}</h3>
              <span className="text-sm text-slate-500">
                · {group.count} {info.scope === "site" ? (group.count === 1 ? "finding" : "findings") : group.count === 1 ? "page" : "pages"}
              </span>
            </div>
            {info.why && <p className="mt-2 text-sm text-slate-600">{info.why}</p>}
            {info.fix && (
              <p className="mt-2 text-sm text-slate-800">
                <span className="font-semibold">How to fix: </span>
                {info.fix}
              </p>
            )}
            <ul className="mt-3 space-y-1 text-sm">
              {group.urls.map((url, index) => (
                <li key={`${url}-${index}`} className="flex flex-wrap gap-x-2 text-slate-600">
                  <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-indigo-600 hover:underline">
                    {url}
                  </a>
                  {group.details[index] && <span className="text-slate-500">({group.details[index]})</span>}
                </li>
              ))}
            </ul>
            {group.count > group.urls.length && (
              <p className="mt-2 text-xs text-slate-500">+ {group.count - group.urls.length} more in the CSV export</p>
            )}
          </Card>
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
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">Page</th>
            <th scope="col" className="px-4 py-3 font-medium">Score</th>
            <th scope="col" className="px-4 py-3 font-medium">Issues</th>
            <th scope="col" className="px-4 py-3 font-medium">Words</th>
            <th scope="col" className="px-4 py-3 font-medium">Schema</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.id} className="align-top">
              <td className="max-w-md px-4 py-3">
                <a href={row.url} target="_blank" rel="noopener noreferrer nofollow" className="font-medium break-all text-indigo-600 hover:underline">
                  {row.url}
                </a>
                <p className="mt-0.5 truncate text-xs text-slate-500">
                  {row.statusCode && row.statusCode >= 400 ? `HTTP ${row.statusCode}` : row.statusCode === 0 ? "Could not load" : row.title || "(no title)"}
                </p>
              </td>
              <td className="px-4 py-3 font-semibold text-slate-900">{row.score ?? "-"}</td>
              <td className="px-4 py-3 text-slate-700">{row.issueCount}</td>
              <td className="px-4 py-3 text-slate-700">{row.words ?? "-"}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{row.schemaTypes || "-"}</td>
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
        <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-500 uppercase">
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
        <tbody className="divide-y divide-slate-100">
          {audits.map((audit) => (
            <tr key={audit.id}>
              <td className="px-4 py-3 whitespace-nowrap text-slate-700">{formatDateTime(audit.startedAt ?? audit.queuedAt)}</td>
              <td className="px-4 py-3 text-slate-700">{TRIGGER_LABEL[audit.trigger] ?? audit.trigger}</td>
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
              <td className="px-4 py-3 font-semibold text-slate-900">{audit.score ?? "-"}</td>
              <td className="px-4 py-3 text-slate-700">{audit.pagesCrawled}</td>
              <td className="px-4 py-3 text-slate-700">{audit.issuesHigh + audit.issuesMedium + audit.issuesLow}</td>
              <td className="px-4 py-3 text-slate-700">{formatDuration(audit.startedAt, audit.finishedAt)}</td>
              <td className="px-4 py-3 text-right">
                {audit.status === "completed" && (
                  <a href={`/api/audits/${audit.id}/export`} download className="text-xs font-medium text-indigo-600 hover:underline">
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
