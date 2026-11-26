"use client";

import { useState } from "react";
import { Spinner } from "../form";

/**
 * Signs the user in (or signs them up) with Google. Navigates the whole page
 * so the server can set HttpOnly OAuth cookies and complete the redirect.
 */
export function GoogleButton({ href, className }: { href: string; className?: string }) {
  const { pending, setPending } = usePending();
  async function onClick() {
    setPending(true);
    window.location.assign(href);
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-ink-300 bg-surface text-ink-900 shadow-sm hover:bg-ink-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aurora-600 disabled:cursor-not-allowed disabled:opacity-60 px-6 py-3 text-base font-semibold transition ${className ?? ""}`}
    >
      {pending ? (
        <Spinner />
      ) : (
        <>
          <span
            className="h-5 w-5 rounded-full flex items-center justify-center"
            style={{
              background:
                "conic-gradient(from 270deg at 50% 50%, #4285F4 0deg 90deg, #EA4335 90deg 180deg, #FBBC05 180deg 270deg, #34A853 270deg 360deg)",
            }}
          >
            <span className="text-xs font-bold text-white">G</span>
          </span>
          Continue with Google
        </>
      )}
    </button>
  );
}

function usePending() {
  const [pending, setPending] = useState(false);
  return { pending, setPending } as const;
}
