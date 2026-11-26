import type { Metadata } from "next";
import { Suspense } from "react";
import { InboxItem } from "@/components/dashboard/messages";
import { Badge, ButtonLink, Card, EmptyState, PageHeader, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { requireUser } from "@/lib/server/auth";
import { listInbox } from "@/lib/server/messages";

export const metadata: Metadata = { title: "Messages" };

export default function MessagesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96" />}>
      <Inbox />
    </Suspense>
  );
}

async function Inbox() {
  const user = await requireUser();
  const items = await listInbox(user.id);
  const unread = items.filter((m) => !m.readAt).length;

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Messages {unread > 0 && <Badge tone="indigo">{unread} unread</Badge>}
          </span>
        }
        description="Updates and announcements from the AEOGo team."
        actions={
          user.isAdmin ? (
            <ButtonLink href="/dashboard/admin/messages" size="sm">
              Compose as admin
            </ButtonLink>
          ) : undefined
        }
      />
      {items.length === 0 ? (
        <EmptyState title="No messages yet" description="When the AEOGo team sends you a message, it'll show up here." />
      ) : (
        <Card className="divide-y divide-ink-100 overflow-hidden">
          {items.map((m, index) => (
            <InboxItem
              key={m.id}
              id={m.id}
              index={index}
              subject={m.subject}
              body={m.body}
              sender={m.senderName ?? "AEOGo team"}
              sentAt={formatDateTime(m.createdAt)}
              unread={!m.readAt}
            />
          ))}
        </Card>
      )}
    </>
  );
}
