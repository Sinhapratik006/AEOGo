import "server-only";
import { randomUUID } from "node:crypto";
import { and, count, desc, eq, isNull, max, min, ne, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { messages, users } from "@/db/schema";

export const SUBJECT_MAX = 150;
export const BODY_MAX = 5000;

export async function unreadMessageCount(userId: string): Promise<number> {
  const [row] = await getDb()
    .select({ n: count() })
    .from(messages)
    .where(and(eq(messages.userId, userId), isNull(messages.readAt)));
  return row?.n ?? 0;
}

export async function listInbox(userId: string, limit = 100) {
  return getDb()
    .select({
      id: messages.id,
      subject: messages.subject,
      body: messages.body,
      readAt: messages.readAt,
      createdAt: messages.createdAt,
      senderName: users.name,
    })
    .from(messages)
    .leftJoin(users, eq(users.id, messages.senderId))
    .where(eq(messages.userId, userId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
}

/** Marks one of the user's own messages as read. Returns false if it isn't theirs. */
export async function markMessageRead(userId: string, messageId: string): Promise<boolean> {
  const db = getDb();
  const [owned] = await db
    .select({ id: messages.id, readAt: messages.readAt })
    .from(messages)
    .where(and(eq(messages.id, messageId), eq(messages.userId, userId)))
    .limit(1);
  if (!owned) return false;
  if (!owned.readAt) await db.update(messages).set({ readAt: new Date() }).where(eq(messages.id, messageId));
  return true;
}

export type SendResult = { batchId: string; recipients: number };

/**
 * Sends a message from an admin to one user (by email) or to every user except
 * the sender. Returns null when the single recipient doesn't exist.
 */
export async function sendAdminMessage(input: {
  senderId: string;
  recipient: "all" | { email: string };
  subject: string;
  body: string;
}): Promise<SendResult | null> {
  const db = getDb();
  const batchId = randomUUID();

  if (input.recipient === "all") {
    // One INSERT ... SELECT so a broadcast is a single round trip however many users there are.
    const result = await db.execute(sql`
      insert into ${messages} (batch_id, user_id, sender_id, subject, body)
      select ${batchId}::uuid, ${users.id}, ${input.senderId}::uuid, ${input.subject}, ${input.body}
      from ${users}
      where ${users.id} <> ${input.senderId}::uuid
    `);
    return { batchId, recipients: result.rowCount ?? 0 };
  }

  const [target] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(sql`lower(${users.email})`, input.recipient.email.toLowerCase()))
    .limit(1);
  if (!target) return null;
  await db.insert(messages).values({
    batchId,
    userId: target.id,
    senderId: input.senderId,
    subject: input.subject,
    body: input.body,
  });
  return { batchId, recipients: 1 };
}

/** Sent history for the admin view: one row per send, with delivery and read counts. */
export async function listSentBatches(limit = 50) {
  return getDb()
    .select({
      batchId: messages.batchId,
      subject: min(messages.subject),
      body: min(messages.body),
      createdAt: max(messages.createdAt),
      recipients: count(),
      read: count(messages.readAt),
      // Only meaningful when recipients = 1.
      recipientEmail: min(users.email),
    })
    .from(messages)
    .innerJoin(users, eq(users.id, messages.userId))
    .groupBy(messages.batchId)
    .orderBy(desc(max(messages.createdAt)))
    .limit(limit);
}

/** Emails for the recipient picker (excluding the admin themselves). */
export async function listRecipientOptions(excludeUserId: string, limit = 1000) {
  return getDb()
    .select({ email: users.email, name: users.name })
    .from(users)
    .where(ne(users.id, excludeUserId))
    .orderBy(users.email)
    .limit(limit);
}
