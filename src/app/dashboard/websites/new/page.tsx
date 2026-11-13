import type { Metadata } from "next";
import { Suspense } from "react";
import { AddWebsiteForm } from "@/components/dashboard/add-website-form";
import { Notice, PageHeader, Skeleton } from "@/components/ui";
import { missingBillingConfig } from "@/lib/dodo";
import { isPlanId } from "@/lib/plans";
import { requireUser } from "@/lib/server/auth";

export const metadata: Metadata = { title: "Add a website" };

export default function NewWebsitePage({ searchParams }: PageProps<"/dashboard/websites/new">) {
  return (
    <>
      <PageHeader
        title="Add a website"
        description="Pick a plan and tell us your website. As soon as checkout completes, the AEO automation starts working on it."
      />
      <Suspense fallback={<Skeleton className="h-[32rem]" />}>
        <NewWebsite searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function NewWebsite({ searchParams }: Pick<PageProps<"/dashboard/websites/new">, "searchParams">) {
  await requireUser();
  const params = await searchParams;
  const plan = isPlanId(params.plan) ? params.plan : "growth";
  const url = typeof params.url === "string" ? params.url.slice(0, 2048) : "";
  const missing = process.env.NODE_ENV !== "production" ? missingBillingConfig() : [];

  return (
    <div className="space-y-6">
      {missing.length > 0 && (
        <Notice tone="amber" title="Billing isn't fully configured (shown in development only)">
          Set {missing.join(", ")} in .env.local. See README for how to create the Dodo Payments products and webhook.
        </Notice>
      )}
      <AddWebsiteForm initialPlan={plan} initialUrl={url} />
    </div>
  );
}
