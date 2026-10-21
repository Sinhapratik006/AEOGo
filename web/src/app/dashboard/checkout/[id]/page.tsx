import { and, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CheckoutStatus } from "@/components/dashboard/checkout-status";
import { Card, Skeleton } from "@/components/ui";
import { getDb } from "@/db";
import { websites } from "@/db/schema";
import { isUuid } from "@/lib/constants";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Confirming your payment" };

/**
 * Dodo redirects here after checkout (the return_url). The website id is in the path
 * so the subscription_id/status query params Dodo appends can't interfere with it.
 */
export default function CheckoutReturnPage({ params, searchParams }: PageProps<"/dashboard/checkout/[id]">) {
  return (
    <div className="mx-auto max-w-lg">
      <Card className="p-8">
        <Suspense fallback={<Skeleton className="h-64" />}>
          <CheckoutResult params={params} searchParams={searchParams} />
        </Suspense>
      </Card>
    </div>
  );
}

async function CheckoutResult({ params, searchParams }: Pick<PageProps<"/dashboard/checkout/[id]">, "params" | "searchParams">) {
  const user = await requireUser();
  const [{ id }, query] = await Promise.all([params, searchParams]);
  if (!isUuid(id)) redirect("/dashboard");

  const [site] = await getDb()
    .select({ id: websites.id, domain: websites.domain, status: websites.status })
    .from(websites)
    .where(and(eq(websites.id, id), eq(websites.userId, user.id)))
    .limit(1);
  if (!site) redirect("/dashboard");

  const paymentStatus = typeof query.status === "string" ? query.status.toLowerCase() : null;
  return <CheckoutStatus websiteId={site.id} domain={site.domain} initialStatus={site.status} paymentStatus={paymentStatus} />;
}
