import "server-only";
import { and, eq } from "drizzle-orm";
import { type DbOrTx } from "@/db";
import { users } from "@/db/schema";
import { HttpError } from "./api";

/** API error code returned when a user tries to claim a second free trial. */
export const FREE_TRIAL_USED_CODE = "FREE_TRIAL_USED";
/** Message shown to users who already used the lifetime free trial. */
export const FREE_TRIAL_USED_MESSAGE =
  "You have already used your free trial. Please choose a paid plan to continue.";

/**
 * Atomically marks the user's lifetime free trial as used. The UPDATE only
 * matches while `free_trial_used` is false, so concurrent claims serialize on
 * the users row and exactly one wins — later calls see zero rows. Call inside a
 * transaction together with the website insert so a failed insert rolls the
 * claim back and a burned claim never exists without a website.
 *
 * Returns true when this call performed the claim; false when the trial was
 * already used.
 */
export async function claimFreeTrial(db: DbOrTx, userId: string): Promise<boolean> {
  const [row] = await db
    .update(users)
    .set({ freeTrialUsed: true, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.freeTrialUsed, false)))
    .returning({ id: users.id });
  return row !== undefined;
}

/** Reads the user's free-trial flag without writing. */
export async function isFreeTrialUsed(db: DbOrTx, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ freeTrialUsed: users.freeTrialUsed })
    .from(users)
    .where(eq(users.id, userId));
  return row?.freeTrialUsed ?? false;
}

/** Throws the user-facing error when the free trial is already used. */
export function assertFreeTrialAvailable(used: boolean): void {
  if (used) throw new HttpError(409, FREE_TRIAL_USED_CODE, FREE_TRIAL_USED_MESSAGE);
}
