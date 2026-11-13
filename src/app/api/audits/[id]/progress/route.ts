import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { audits, websites } from "@/db/schema";
import { requireUser } from "@/lib/server/auth";
import { PLANS } from "@/lib/plans";
import { isUuid } from "@/lib/constants";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const user = await requireUser();
  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  const [row] = await db
    .select({
      id: audits.id,
      status: audits.status,
      progress: audits.progress,
      pagesCrawled: audits.pagesCrawled,
      startedAt: audits.startedAt,
      finishedAt: audits.finishedAt,
      heartbeatAt: audits.heartbeatAt,
      plan: websites.plan,
    })
    .from(audits)
    .innerJoin(websites, eq(websites.id, audits.websiteId))
    .where(and(eq(audits.id, id), eq(websites.userId, user.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const plan = PLANS[row.plan] ?? PLANS.starter;
  const maxPages = plan.maxPages;

  let percentage = 0;
  let stage = row.progress ?? (row.status === "queued" ? "Queued" : row.status);

  if (row.status === "completed") {
    percentage = 100;
    stage = "Finished";
  } else if (row.status === "failed") {
    percentage = 0;
    stage = "Failed";
  } else if (row.status === "cancelled") {
    percentage = 0;
    stage = "Cancelled";
  } else if (row.status === "running") {
    const msg = (row.progress ?? "").toLowerCase();
    if (msg.includes("writing") || msg.includes("fixes")) {
      percentage = 92;
      stage = "Writing your fixes";
    } else if (row.pagesCrawled > 0 && maxPages > 0) {
      // Crawl prep takes roughly the first 20%, then pages take 20->90%.
      const crawlShare = Math.min(1, row.pagesCrawled / maxPages);
      percentage = Math.round(20 + crawlShare * 70);
      stage = `Crawling pages (${row.pagesCrawled}/${maxPages})`;
    } else {
      percentage = 10;
      stage = "Starting";
    }
  } else if (row.status === "queued") {
    percentage = 0;
    stage = "Queued — waiting for a crawler";
  }

  const startedAt = row.startedAt ? new Date(row.startedAt).getTime() : null;
  const elapsedMs = startedAt ? Date.now() - startedAt : null;

  return NextResponse.json({
    id: row.id,
    status: row.status,
    progress: row.progress,
    stage,
    percentage,
    pagesCrawled: row.pagesCrawled,
    maxPages,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    heartbeatAt: row.heartbeatAt,
    elapsedMs,
  });
}
