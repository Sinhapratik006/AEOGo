"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Field, FormError, Spinner } from "../form";
import { buttonClasses } from "../ui";

export function LoginForm({ next }: { next: string | null }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/auth/login", { body: { email: form.get("email"), password: form.get("password") } });
      window.location.assign(next ?? "/dashboard");
    } catch (err) {
      setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <Field id="email" name="email" type="email" label="Email" autoComplete="email" required autoFocus />
      <div>
        <Field id="password" name="password" type="password" label="Password" autoComplete="current-password" required />
        <div className="mt-2 text-right">
          <Link href="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Forgot your password?
          </Link>
        </div>
      </div>
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg") + " w-full"}>
        {pending && <Spinner />} Sign in
      </button>
      <p className="text-center text-sm text-slate-600">
        New to AEOGo?{" "}
        <Link
          href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
          className="font-semibold text-indigo-600 hover:text-indigo-500"
        >
          Create an account
        </Link>
      </p>
    </form>
  );
}
