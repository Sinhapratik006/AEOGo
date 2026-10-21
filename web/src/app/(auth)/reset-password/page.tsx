import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { AuthFormFallback } from "../auth-fallback";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
};

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-slate-900">Choose a new password</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">You&apos;ll be signed in once it&apos;s saved.</p>
      <Suspense fallback={<AuthFormFallback />}>
        <ResetFormWithToken searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function ResetFormWithToken({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const { token } = await searchParams;
  return <ResetPasswordForm token={typeof token === "string" ? token : ""} />;
}
