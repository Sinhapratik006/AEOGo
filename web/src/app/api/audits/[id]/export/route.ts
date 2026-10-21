import { and, asc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { audits, issues, websites } from "@/db/schema";
import { issueInfo } from "@/lib/aeo/issues";
import { isUuid } from "@/lib/constants";
import { HttpError, requireApiUser, withApi } from "@/lib/server/api";

/** Quotes a CSV cell and neutralizes spreadsheet formulas (=, +, -, @). */
function cell(value: string | null | undefined): string {
  let text = value ?? "";
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export const GET = withApi(async (_req: Request, ctx: RouteContext<"/api/audits/[id]/export">) => {
  const user = await requireApiUser();
  const { id } = await ctx.params;
  if (!isUuid(id)) throw new HttpError(404, "NOT_FOUND", "Audit not found.");

  const db = getDb();
  const [audit] = await db
    .select({ id: audits.id, domain: websites.domain, queuedAt: audits.queuedAt })
    .from(audits)
    .innerJoin(websites, eq(websites.id, audits.websiteId))
    .where(and(eq(audits.id, id), eq(websites.userId, user.id)))
    .limit(1);
  if (!audit) throw new HttpError(404, "NOT_FOUND", "Audit not found.");

  const rows = await db
    .select({ url: issues.url, code: issues.code, severity: issues.severity, detail: issues.detail })
    .from(issues)
    .where(eq(issues.auditId, id))
    .orderBy(sql`case ${issues.severity} when 'high' then 0 when 'medium' then 1 else 2 end`, asc(issues.code), asc(issues.url));

  const lines = [["Severity", "Issue code", "Issue", "URL", "Detail", "How to fix"].map(cell).join(",")];
  for (const row of rows) {
    const info = issueInfo(row.code);
    lines.push([row.severity, row.code, info.title, row.url, row.detail, info.fix].map(cell).join(","));
  }
  const date = audit.queuedAt.toISOString().slice(0, 10);
  const filename = `aeo-issues-${audit.domain.replace(/[^a-z0-9.-]/gi, "")}-${date}.csv`;
  return new Response(`\uFEFF${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
});
