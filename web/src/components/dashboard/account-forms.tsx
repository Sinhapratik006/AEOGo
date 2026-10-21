"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { Field, FormError, Spinner } from "../form";
import { buttonClasses } from "../ui";

export function NameForm({ initialName }: { initialName: string }) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setPending(true);
    try {
      await api("/api/account", { method: "PATCH", body: { name } });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="name" name="name" label="Name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required className="max-w-md" />
      <FormError message={error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || !name.trim()} className={buttonClasses("primary", "sm")}>
          {pending && <Spinner />} Save
        </button>
        {saved && <span className="text-sm text-emerald-600">Saved</span>}
      </div>
    </form>
  );
}

export function PasswordForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const newPassword = String(form.get("newPassword") ?? "");
    setErrors({});
    setError(null);
    setSaved(false);
    if (newPassword.length < 8) return setErrors({ newPassword: "Password must be at least 8 characters." });
    if (newPassword !== String(form.get("confirmPassword") ?? "")) return setErrors({ confirmPassword: "The passwords don't match." });
    setPending(true);
    try {
      await api("/api/account/password", {
        body: { currentPassword: form.get("currentPassword"), newPassword },
      });
      formElement.reset();
      setSaved(true);
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message });
      else setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
      <Field id="currentPassword" name="currentPassword" type="password" label="Current password" autoComplete="current-password" required error={errors.currentPassword} />
      <Field id="newPassword" name="newPassword" type="password" label="New password" autoComplete="new-password" required hint="At least 8 characters." error={errors.newPassword} />
      <Field id="confirmPassword" name="confirmPassword" type="password" label="Confirm new password" autoComplete="new-password" required error={errors.confirmPassword} />
      <FormError message={error} />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonClasses("primary", "sm")}>
          {pending && <Spinner />} Change password
        </button>
        {saved && <span className="text-sm text-emerald-600">Password changed. Other devices were signed out.</span>}
      </div>
    </form>
  );
}
