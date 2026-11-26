import type { Metadata } from "next";
import { Suspense } from "react";
import { ComposeMessageForm } from "@/components/dashboard/messages";
import { Badge, Card, PageHeader, Skeleton } from "@/components/ui";
import { formatDateTime } from "@/lib/format";
import { requireAdmin } from "@/lib/server/auth";
import { listRecipientOptions, listSentBatches } from "@/lib/server/messages";

export const metadata: Metadata = { title: "Admin messages" };

export default function AdminMessagesPage() {
  return (
    <Suspense fallback={<Skeleton className="h-[32rem]" />}>
      <AdminMessages />
    </Suspense>
  );
}

async function AdminMessages() {
  const admin = await requireAdmin();
  const [recipients, sent] = await Promise.all([listRecipientOptions(admin.id), listSentBatches()]);

  return (
    <>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            Admin messages <Badge tone="indigo">Admin</Badge>
          </span>
        }
        description="Message one user or broadcast to everyone. Messages appear in each user's Messages inbox."
      />
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="p-6 lg:col-span-3">
          <h2 className="mb-5 font-semibold text-ink-900">New message</h2>
          <ComposeMessageForm recipients={recipients} />
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <h2 className="border-b border-ink-100 px-5 py-4 font-semibold text-ink-900">Sent</h2>
          {sent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-ink-500">Nothing sent yet.</p>
          ) : (
            <ul className="max-h-[36rem] divide-y divide-ink-100 overflow-y-auto">
              {sent.map((batch, index) => (
                <li
                  key={batch.batchId}
                  className="animate-fade-up px-5 py-4"
                  style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="truncate text-sm font-medium text-ink-900">{batch.subject}</p>
                    <time className="shrink-0 text-xs text-ink-500">{formatDateTime(batch.createdAt)}</time>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{batch.body}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Badge tone="gray">
                      {batch.recipients === 1 ? batch.recipientEmail : `${batch.recipients} users`}
                    </Badge>
                    <Badge tone={batch.read === batch.recipients ? "green" : "blue"}>
                      {batch.recipients === 1
                        ? batch.read
                          ? "Read"
                          : "Unread"
                        : `${batch.read}/${batch.recipients} read`}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
