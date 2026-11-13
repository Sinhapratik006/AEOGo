import type { DbOrTx } from "@/db";
import { audits } from "@/db/schema";
import type { AuditTrigger } from "./constants";

/**
 * Queues an audit for a website. A partial unique index guarantees at most one
 * queued/running audit per website, so concurrent calls can't create duplicates.
 * Returns the new audit id, or null when an audit is already queued or running.
 */
export async function enqueueAudit(db: DbOrTx, websiteId: string, trigger: AuditTrigger): Promise<string | null> {
  const rows = await db
    .insert(audits)
    .values({ websiteId, trigger, status: "queued" })
    .onConflictDoNothing()
    .returning({ id: audits.id });
  return rows[0]?.id ?? null;
}
