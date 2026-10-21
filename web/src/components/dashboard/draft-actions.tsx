"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, errorMessage } from "@/lib/client/api";
import type { DraftStatus } from "@/lib/constants";
import { buttonClasses } from "../ui";

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className={buttonClasses("secondary", "sm")}
      onClick={async () => {
        try {
          await copyToClipboard(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          window.prompt("Copy this text:", text);
        }
      }}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}

export function DraftActions({ draftId, status, copyText }: { draftId: string; status: DraftStatus; copyText: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: DraftStatus) {
    setPending(true);
    setError(null);
    try {
      await api(`/api/drafts/${draftId}`, { method: "PATCH", body: { status: next } });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CopyButton text={copyText} />
      {status === "draft" ? (
        <>
          <button type="button" disabled={pending} onClick={() => setStatus("approved")} className={buttonClasses("primary", "sm")}>
            Mark as applied
          </button>
          <button type="button" disabled={pending} onClick={() => setStatus("rejected")} className={buttonClasses("ghost", "sm")}>
            Dismiss
          </button>
        </>
      ) : (
        <button type="button" disabled={pending} onClick={() => setStatus("draft")} className={buttonClasses("ghost", "sm")}>
          Undo
        </button>
      )}
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </div>
  );
}
