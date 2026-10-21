"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { Field, FormError, Spinner } from "../form";
import { buttonClasses } from "../ui";

export function SignupForm({ destination, loginHref }: { destination: string; loginHref: string }) {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (password.length < 8) {
      setFieldErrors({ password: "Password must be at least 8 characters." });
      return;
    }
    setPending(true);
    try {
      await api("/api/auth/signup", {
        body: { name: form.get("name"), email: form.get("email"), password },
      });
      window.location.assign(destination);
    } catch (err) {
      if (err instanceof ApiError && err.field) setFieldErrors({ [err.field]: err.message });
      else setError(errorMessage(err));
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <Field id="name" name="name" label="Your name" autoComplete="name" required autoFocus error={fieldErrors.name} />
      <Field id="email" name="email" type="email" label="Work email" autoComplete="email" required error={fieldErrors.email} />
      <Field
        id="password"
        name="password"
        type="password"
        label="Password"
        autoComplete="new-password"
        required
        minLength={8}
        hint="At least 8 characters."
        error={fieldErrors.password}
      />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg") + " w-full"}>
        {pending && <Spinner />} Create account
      </button>
      <p className="text-center text-xs text-slate-500">
        By creating an account you agree to our{" "}
        <Link href="/terms" className="underline hover:text-slate-700">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="underline hover:text-slate-700">
          Privacy Policy
        </Link>
        .
      </p>
      <p className="text-center text-sm text-slate-600">
        Already have an account?{" "}
        <Link href={loginHref} className="font-semibold text-indigo-600 hover:text-indigo-500">
          Sign in
        </Link>
      </p>
    </form>
  );
}
