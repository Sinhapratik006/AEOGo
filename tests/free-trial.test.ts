import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import assert from "node:assert";
import { loadEnv } from "../scripts/load-env";
loadEnv();
import { eq } from "drizzle-orm";
import { getDb, closeDb } from "@/db";
import { users, websites } from "@/db/schema";
import { HttpError } from "@/lib/server/api";
import {
  assertFreeTrialAvailable,
  claimFreeTrial,
  FREE_TRIAL_USED_CODE,
  FREE_TRIAL_USED_MESSAGE,
  isFreeTrialUsed,
} from "@/lib/server/free-trial";

/**
 * Integration tests for the one-lifetime-free-trial guarantee, run against the
 * real database (DATABASE_URL). Every test creates throwaway users with random
 * emails and deletes them afterwards; deleting a user cascades their websites.
 */

const db = getDb();

let userIds: string[] = [];

async function createUser(): Promise<string> {
  const email = `trial-user-${randomUUID()}@example.com`;
  const [row] = await db.insert(users).values({ name: "Free Trial Test", email }).returning({ id: users.id });
  userIds.push(row.id);
  return row.id;
}

async function insertFreeWebsite(userId: string, url: string): Promise<string> {
  const [site] = await db
    .insert(websites)
    .values({ userId, url, domain: new URL(url).hostname, plan: "free", status: "active" })
    .returning({ id: websites.id });
  return site.id;
}

async function deleteUser(userId: string): Promise<void> {
  await db.delete(users).where(eq(users.id, userId));
}

before(() => {
  userIds = [];
});

after(async () => {
  for (const id of userIds) await deleteUser(id);
  await closeDb();
});

test("a new user can claim the free trial once, then no more", async () => {
  const userId = await createUser();
  assert.equal(await isFreeTrialUsed(db, userId), false, "new user has not used the trial");

  const first = await claimFreeTrial(db, userId);
  assert.equal(first, true, "first claim succeeds");
  assert.equal(await isFreeTrialUsed(db, userId), true, "trial is marked used");

  const second = await claimFreeTrial(db, userId);
  assert.equal(second, false, "second claim is refused");
  assert.equal(await isFreeTrialUsed(db, userId), true);
});

test("deleting a website never resets the trial flag", async () => {
  const userId = await createUser();
  const siteId = await insertFreeWebsite(userId, `https://trial-${randomUUID()}.example.com`);

  assert.equal(await claimFreeTrial(db, userId), true, "claim succeeds while the site is present");
  await db.delete(websites).where(eq(websites.id, siteId));

  assert.equal(await isFreeTrialUsed(db, userId), true, "trial stays used after the website is deleted");
  assert.equal(await claimFreeTrial(db, userId), false, "cannot claim a new trial after adding another website");
});

test("the flag survives a logout/login round-trip (it lives on the user row)", async () => {
  const userId = await createUser();
  assert.equal(await claimFreeTrial(db, userId), true);

  const [row] = await db.select().from(users).where(eq(users.id, userId));
  assert.equal(row?.freeTrialUsed, true, "free_trial_used persists on the user row");
  assert.equal(await isFreeTrialUsed(db, userId), true);
});

test("each user gets their own lifetime trial", async () => {
  const a = await createUser();
  const b = await createUser();
  assert.equal(await claimFreeTrial(db, a), true);
  assert.equal(await claimFreeTrial(db, b), true, "a different user still has their trial available");
  assert.equal(await claimFreeTrial(db, a), false);
});

test("concurrent claims: exactly one succeeds", async () => {
  const userId = await createUser();
  const N = 10;
  const results = await Promise.all([...Array(N)].map(() => claimFreeTrial(db, userId)));
  const wins = results.filter((r) => r).length;
  assert.equal(wins, 1, `exactly one of ${N} concurrent claims wins, got ${wins}`);
  assert.equal(await isFreeTrialUsed(db, userId), true);
});

test("assertFreeTrialAvailable throws the user-facing message when used", async () => {
  const userId = await createUser();
  assert.doesNotThrow(() => assertFreeTrialAvailable(false));
  await claimFreeTrial(db, userId);
  assert.throws(
    () => assertFreeTrialAvailable(true),
    (err: unknown) =>
      err instanceof HttpError && err.status === 409 && err.code === FREE_TRIAL_USED_CODE,
    "throws HttpError 409 with the FREE_TRIAL_USED code",
  );
  try {
    assertFreeTrialAvailable(true);
    assert.fail("expected assertFreeTrialAvailable to throw");
  } catch (err) {
    assert.equal(err instanceof HttpError ? err.message : null, FREE_TRIAL_USED_MESSAGE);
  }
});
