import os from "node:os";
import { sql } from "drizzle-orm";
import { loadEnv } from "../scripts/load-env";

loadEnv();

const WORKER_ID = `${os.hostname()}:${process.pid}`;
const POLL_INTERVAL_MS = 3_000;
const SCHEDULE_INTERVAL_MS = 30_000;
const RECOVERY_INTERVAL_MS = 60_000;
const CLEANUP_INTERVAL_MS = 60 * 60_000;
const STALE_AFTER = "10 minutes";
const MAX_ATTEMPTS = 3;
const KEEP_DETAILED_AUDITS = 5;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  // Imported after loadEnv() so every module sees the configured environment.
  const { getDb, closeDb } = await import("../src/db");
  const { runAudit } = await import("../src/lib/aeo/run-audit");
  const { envInt } = await import("../src/lib/env");
  const { aiEnabled, aiModel } = await import("../src/lib/aeo/ai-drafts");

  const db = getDb();
  const concurrency = Math.max(1, envInt("WORKER_CONCURRENCY", 2));
  const running = new Set<Promise<void>>();
  let shuttingDown = false;

  await db.execute(sql`select 1`);
  console.log(
    `[worker] ${WORKER_ID} started: concurrency=${concurrency}, ` +
      `AI fixes=${aiEnabled() ? `on (${aiModel()})` : "off (ANTHROPIC_API_KEY not set)"}`,
  );

  async function claimNextAudit(): Promise<string | null> {
    // SKIP LOCKED lets any number of workers claim jobs without stepping on each other.
    // Pro sites are picked first ("priority crawling queue").
    const result = await db.execute<{ id: string }>(sql`
      update audits
      set status = 'running', started_at = now(), heartbeat_at = now(),
          attempts = attempts + 1, worker_id = ${WORKER_ID}, progress = 'Starting', error = null
      where id = (
        select a.id from audits a
        join websites w on w.id = a.website_id
        where a.status = 'queued'
        order by case w.plan when 'pro' then 0 when 'growth' then 1 else 2 end, a.queued_at
        limit 1
        for update of a skip locked
      )
      returning id
    `);
    return result.rows[0]?.id ?? null;
  }

  async function scheduleDueAudits() {
    const result = await db.execute(sql`
      insert into audits (website_id, trigger, status)
      select w.id, 'scheduled', 'queued'
      from websites w
      where w.status in ('active', 'past_due')
        and w.next_audit_at is not null
        and w.next_audit_at <= now()
        and not exists (
          select 1 from audits a where a.website_id = w.id and a.status in ('queued', 'running')
        )
      on conflict do nothing
    `);
    if (result.rowCount) console.log(`[worker] scheduled ${result.rowCount} recurring audit(s)`);
  }

  async function recoverStaleAudits() {
    const requeued = await db.execute(sql`
      update audits
      set status = 'queued', worker_id = null, progress = 'Retrying after an interruption'
      where status = 'running'
        and heartbeat_at < now() - ${STALE_AFTER}::interval
        and attempts < ${MAX_ATTEMPTS}
    `);
    const failed = await db.execute<{ website_id: string }>(sql`
      update audits
      set status = 'failed', finished_at = now(), progress = null,
          error = 'The audit was interrupted too many times'
      where status = 'running'
        and heartbeat_at < now() - ${STALE_AFTER}::interval
        and attempts >= ${MAX_ATTEMPTS}
      returning website_id
    `);
    for (const row of failed.rows) {
      await db.execute(sql`update websites set next_audit_at = now() + interval '6 hours' where id = ${row.website_id}`);
    }
    if (requeued.rowCount || failed.rowCount) {
      console.log(`[worker] recovered stale audits: requeued=${requeued.rowCount ?? 0}, failed=${failed.rowCount ?? 0}`);
    }
  }

  async function cleanup() {
    await db.execute(sql`delete from sessions where expires_at < now()`);
    await db.execute(sql`delete from password_reset_tokens where expires_at < now() - interval '1 day'`);
    await db.execute(sql`delete from rate_limits where window_start < now() - interval '2 days'`);
    await db.execute(sql`delete from webhook_events where processed_at is not null and received_at < now() - interval '90 days'`);
    // Keep scores for every audit, but page-level detail only for the most recent ones.
    const old = sql`
      select id from (
        select id, row_number() over (partition by website_id order by queued_at desc) as rn
        from audits where status in ('completed', 'failed', 'cancelled')
      ) ranked where rn > ${KEEP_DETAILED_AUDITS}
    `;
    await db.execute(sql`delete from issues where audit_id in (${old})`);
    await db.execute(sql`delete from pages where audit_id in (${old})`);
  }

  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[worker] ${signal} received, finishing up...`);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  let lastSchedule = 0;
  let lastRecovery = 0;
  let lastCleanup = 0;
  while (!shuttingDown) {
    const now = Date.now();
    try {
      if (now - lastRecovery >= RECOVERY_INTERVAL_MS) {
        lastRecovery = now;
        await recoverStaleAudits();
      }
      if (now - lastSchedule >= SCHEDULE_INTERVAL_MS) {
        lastSchedule = now;
        await scheduleDueAudits();
      }
      if (now - lastCleanup >= CLEANUP_INTERVAL_MS) {
        lastCleanup = now;
        await cleanup();
      }
      while (running.size < concurrency && !shuttingDown) {
        const auditId = await claimNextAudit();
        if (!auditId) break;
        console.log(`[worker] running audit ${auditId}`);
        const job: Promise<void> = runAudit(auditId)
          .then(() => console.log(`[worker] finished audit ${auditId}`))
          .finally(() => running.delete(job));
        running.add(job);
      }
    } catch (err) {
      console.error("[worker] loop error", err);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  // Give in-flight audits a moment, then hand unfinished ones back to the queue.
  await Promise.race([Promise.allSettled([...running]), sleep(20_000)]);
  if (running.size > 0) {
    await db.execute(sql`
      update audits set status = 'queued', worker_id = null, progress = 'Retrying after a restart'
      where status = 'running' and worker_id = ${WORKER_ID}
    `);
    console.log(`[worker] released ${running.size} unfinished audit(s) back to the queue`);
  }
  await closeDb();
  console.log("[worker] stopped");
  process.exit(0);
}

main().catch((err) => {
  console.error("[worker] fatal error", err);
  process.exit(1);
});
