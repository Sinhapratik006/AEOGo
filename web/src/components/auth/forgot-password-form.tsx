"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Field, FormError, Spinner } from "../form";
import { buttonClasses } from "../ui";

export function ForgotPasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/auth/forgot-password", { body: { email: form.get("email") } });
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <p className="text-sm text-slate-700">
          If an account exists for that email, we&apos;ve sent a link to reset your password. It expires in 1 hour.
        </p>
        <Link href="/login" className="text-sm font-semibold text-indigo-600 hover:text-indigo-500">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" required autoFocus />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg") + " w-full"}>
        {pending && <Spinner />} Send reset link
      </button>
      <p className="text-center text-sm text-slate-600">
        Remembered it?{" "}
        <Link href="/login" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Sign in
        </Link>
      </p>
    </form>
  );
}
