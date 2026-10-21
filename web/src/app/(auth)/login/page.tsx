import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentUser } from "@/lib/server/auth";
import { safeNextPath } from "@/lib/url";
import { AuthFormFallback } from "../auth-fallback";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Welcome back</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">Sign in to see your AEO reports and fixes.</p>
      <Suspense fallback={<AuthFormFallback />}>
        <LoginGate searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function LoginGate({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getCurrentUser()) redirect(next ?? "/dashboard");
  return <LoginForm next={next} />;
}
