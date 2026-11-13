"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import { Card, buttonClasses } from "@/components/ui";
import { FormError, Spinner } from "@/components/form";

export function GoogleAccountCard({
  googleLinked,
  hasPassword,
}: {
  googleLinked: boolean;
  hasPassword: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function disconnect() {
    setError(null);
    setPending(true);
    try {
      await api("/api/auth/google/disconnect", { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-slate-900">Google Account</h2>
      {googleLinked ? (
        <>
          <p className="mt-1 mb-4 text-sm text-slate-600">Your Google account is connected.</p>
          {hasPassword ? (
            <form onSubmit={(event) => { event.preventDefault(); disconnect(); }} className="space-y-3">
              <FormError message={error} />
              <button type="submit" disabled={pending} className={buttonClasses("danger", "sm")}>
                {pending && <Spinner />} Disconnect Google
              </button>
              <p className="text-xs text-slate-500">
                You&apos;ll still be able to sign in with your email and password.
              </p>
            </form>
          ) : (
            <p className="text-sm text-slate-600">
              Set a password in the Password section before you can disconnect Google.
            </p>
          )}
        </>
      ) : (
        <>
          <p className="mt-1 mb-4 text-sm text-slate-600">
            Not connected. Connect your Google account to sign in without a password.
          </p>
          <button
            type="button"
            onClick={() => {
              // Full navigation: the server sets HttpOnly OAuth cookies and
              // redirects to Google, which a client-side router push can't do.
              // eslint-disable-next-line @next/next/no-location-assign-relative-destination
              window.location.assign(
                `/api/auth/google?connect=1&next=${encodeURIComponent("/dashboard/settings")}`,
              );
            }}
            className={buttonClasses("primary", "sm")}
          >
            Connect Google
          </button>
        </>
      )}
    </Card>
  );
}
