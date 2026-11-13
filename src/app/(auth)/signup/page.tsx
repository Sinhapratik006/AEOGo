import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { SignupForm } from "@/components/auth/signup-form";
import { isPlanId, PLANS } from "@/lib/plans";
import { getCurrentUser } from "@/lib/server/auth";
import { safeNextPath } from "@/lib/url";
import { AuthFormFallback } from "../auth-fallback";

export const metadata: Metadata = {
  title: "Create your account",
  description: "Create an AEOGo account and start optimizing your website for AI answer engines.",
};

export default function SignupPage({ searchParams }: PageProps<"/signup">) {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Create your account</h1>
      <Suspense fallback={<p className="mt-1 mb-6 text-sm text-slate-600">Next, you&apos;ll add your website and choose a plan.</p>}>
        <PlanNote searchParams={searchParams} />
      </Suspense>
      <Suspense fallback={<AuthFormFallback fields={3} />}>
        <SignupGate searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function PlanNote({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const { plan } = await searchParams;
  return (
    <p className="mt-1 mb-6 text-sm text-slate-600">
      {isPlanId(plan)
        ? `You picked the ${PLANS[plan].name} plan. Next, you'll add your website and check out.`
        : "Next, you'll add your website and choose a plan."}
    </p>
  );
}

async function SignupGate({ searchParams }: Pick<PageProps<"/signup">, "searchParams">) {
  const params = await searchParams;
  const plan = isPlanId(params.plan) ? params.plan : null;
  const destination =
    safeNextPath(params.next) ?? (plan ? `/dashboard/websites/new?plan=${plan}` : "/dashboard/websites/new");
  if (await getCurrentUser()) redirect(destination);
  return <SignupForm destination={destination} loginHref={`/login?next=${encodeURIComponent(destination)}`} />;
}
