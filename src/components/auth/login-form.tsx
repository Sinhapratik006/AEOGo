"use client";

import Link from "next/link";
import { useState, type ChangeEvent, type FormEvent } from "react";
import { ApiError, api, errorMessage } from "@/lib/client/api";
import { isValidEmail } from "@/lib/email";
import { Field, FormError, Spinner } from "../form";
import { GoogleButton } from "./google-button";
import { buttonClasses } from "../ui";

type FieldName = "email" | "password";

export function LoginForm({ next, error: urlError }: { next: string | null; error: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [error, setError] = useState<string | null>(urlError);
  const [pending, setPending] = useState(false);
  const googleHref = `/api/auth/google${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  function clearFieldError(field: FieldName) {
    setFieldErrors((prev) => (prev[field] ? { ...prev, [field]: undefined } : prev));
  }

  function onEmailChange(event: ChangeEvent<HTMLInputElement>) {
    setEmail(event.target.value);
    clearFieldError("email");
  }

  function onPasswordChange(event: ChangeEvent<HTMLInputElement>) {
    setPassword(event.target.value);
    clearFieldError("password");
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return; // prevent duplicate submissions while a request is in flight

    // Client-side validation: report empty/malformed fields, keep the form intact.
    const errors: Partial<Record<FieldName, string>> = {};
    const trimmedEmail = email.trim();
    if (!trimmedEmail) errors.email = "Please enter your email address.";
    else if (!isValidEmail(trimmedEmail)) errors.email = "Please enter a valid email address.";
    if (!password) errors.password = "Please enter your password.";
    setFieldErrors(errors);
    setError(null);
    if (Object.keys(errors).length > 0) return;

    setPending(true);
    try {
      await api("/api/auth/login", {
        body: { email: trimmedEmail, password },
        redirectOnAuth: false,
      });
      window.location.assign(next ?? "/dashboard");
    } catch (err) {
      if (err instanceof ApiError && err.status === 401 && err.code === "INVALID_CREDENTIALS") {
        // Generic message: never reveal whether the account exists or which part failed.
        setFieldErrors({ password: err.message });
      } else {
        // Network errors, rate limits, validation failures and unexpected errors
        // surface as a form-level message instead of resetting the form.
        setError(errorMessage(err));
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <FormError message={error} />
      <Field
        id="email"
        name="email"
        type="email"
        label="Email"
        autoComplete="email"
        required
        autoFocus
        value={email}
        onChange={onEmailChange}
        error={fieldErrors.email ?? null}
      />
      <div>
        <Field
          id="password"
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          required
          value={password}
          onChange={onPasswordChange}
          error={fieldErrors.password ?? null}
        />
        <div className="mt-2 text-right">
          <Link href="/forgot-password" className="text-sm font-medium text-indigo-600 hover:text-indigo-500">
            Forgot your password?
          </Link>
        </div>
      </div>
      <button type="submit" disabled={pending} className={buttonClasses("primary", "lg") + " w-full"}>
        {pending && <Spinner />} Sign in
      </button>
      <p className="text-center text-xs text-slate-500">— Or continue with —</p>
      <GoogleButton href={googleHref} className="w-full" />
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
