"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Field, FormError, Spinner } from "../form";
import { buttonClasses } from "../ui";

export function ResetPasswordForm({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password !== String(form.get("confirm") ?? "")) return setError("The passwords don't match.");
    setPending(true);
    try {
      await api("/api/auth/reset-password", { body: { token, password } });
      // Full page load on purpose: the session changed, so no client-cached pages may survive.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/dashboard");
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  if (!token) {
    return (
      <div className="space-y-4 text-center text-sm text-slate-700">
        <p>This reset link is missing its token.</p>
        <Link href="/forgot-password" className="font-semibold text-indigo-600 hover:text-indigo-500">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <Field id="password" name="password" type="password" label="New password" autoComplete="new-password" required autoFocus hint="At least 8 characters." />
      <Field id="confirm" name="confirm" type="password" label="Confirm new password" autoComplete="new-password" required />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg") + " w-full"}>
        {pending && <Spinner />} Set new password
      </button>
    </form>
  );
}
