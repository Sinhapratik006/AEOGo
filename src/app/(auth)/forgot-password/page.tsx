import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-ink-900">Reset your password</h1>
      <p className="mt-1 mb-6 text-sm text-ink-600">Enter your email and we&apos;ll send you a reset link.</p>
      <ForgotPasswordForm />
    </>
  );
}
