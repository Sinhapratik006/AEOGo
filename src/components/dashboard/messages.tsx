"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { api, ApiError, errorMessage } from "@/lib/client/api";
import { Field, FormError, Spinner } from "../form";
import { buttonClasses, cn } from "../ui";

/** One inbox message. Opening an unread message marks it read. */
export function InboxItem({
  id,
  subject,
  body,
  sender,
  sentAt,
  unread: initiallyUnread,
  index,
}: {
  id: string;
  subject: string;
  body: string;
  sender: string;
  sentAt: string;
  unread: boolean;
  index: number;
}) {
  const router = useRouter();
  const [unread, setUnread] = useState(initiallyUnread);

  function onToggle(event: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!event.currentTarget.open || !unread) return;
    setUnread(false);
    // Fire and forget: refresh afterwards so the nav's unread badge updates.
    api(`/api/messages/${id}/read`)
      .then(() => router.refresh())
      .catch(() => setUnread(true));
  }

  return (
    <details
      onToggle={onToggle}
      className="group animate-fade-up px-5 py-4 transition-colors open:bg-aurora-50/30 hover:bg-ink-50 [&_summary::-webkit-details-marker]:hidden"
      style={{ animationDelay: `${Math.min(index, 10) * 50}ms` }}
    >
      <summary className="flex cursor-pointer list-none items-start gap-3">
        <span
          aria-hidden="true"
          className={cn(
            "mt-1.5 h-2 w-2 shrink-0 rounded-full transition",
            unread ? "bg-aurora-600 shadow-[0_0_10px_var(--color-aurora-600)]" : "bg-transparent",
          )}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <p className={cn("truncate text-sm", unread ? "font-semibold text-ink-950" : "font-medium text-ink-700")}>
              {subject}
              {unread && <span className="sr-only"> (unread)</span>}
            </p>
            <time className="shrink-0 text-xs text-ink-500">{sentAt}</time>
          </div>
          <p className="mt-0.5 truncate text-xs text-ink-500 group-open:hidden">{body}</p>
          <p className="mt-0.5 hidden text-xs text-ink-500 group-open:block">From {sender}</p>
        </div>
        <span
          aria-hidden="true"
          className="mt-0.5 text-ink-400 transition duration-300 group-open:rotate-90 group-open:text-aurora-600"
        >
          ›
        </span>
      </summary>
      <div className="mt-3 animate-fade-up pl-5 text-sm leading-relaxed whitespace-pre-wrap text-ink-800">{body}</div>
    </details>
  );
}

const SUBJECT_MAX = 150;
const BODY_MAX = 5000;

export function ComposeMessageForm({ recipients }: { recipients: Array<{ email: string; name: string }> }) {
  const router = useRouter();
  const [to, setTo] = useState<"all" | "one">("one");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrors({});
    setError(null);
    setSent(null);
    if (to === "all" && !window.confirm(`Send this message to all ${recipients.length} users?`)) return;
    setPending(true);
    try {
      const res = await api<{ recipients: number }>("/api/admin/messages", {
        body: to === "all" ? { to: "all", subject, body } : { email, subject, body },
      });
      setSent(`Sent to ${res.recipients} ${res.recipients === 1 ? "user" : "users"}.`);
      setSubject("");
      setBody("");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError && err.field) setErrors({ [err.field]: err.message });
      else setError(errorMessage(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <fieldset>
        <legend className="text-sm font-medium text-ink-800">Send to</legend>
        <div className="mt-2 inline-flex rounded-lg bg-ink-100 p-1 ring-1 ring-ink-200">
          {(
            [
              ["one", "One user"],
              ["all", `All users (${recipients.length})`],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium transition duration-300",
                to === value
                  ? "bg-aurora-600 text-on-accent shadow-[0_0_16px_-4px_var(--color-aurora-600)]"
                  : "text-ink-600 hover:text-ink-900",
              )}
            >
              <input
                type="radio"
                name="to"
                value={value}
                checked={to === value}
                onChange={() => setTo(value)}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      {to === "one" && (
        <div className="animate-fade-up">
          <Field
            id="email"
            name="email"
            type="email"
            label="Recipient email"
            list="recipient-options"
            autoComplete="off"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={errors.email}
            hint="Start typing to search registered users."
            required
          />
          <datalist id="recipient-options">
            {recipients.map((r) => (
              <option key={r.email} value={r.email}>
                {r.name}
              </option>
            ))}
          </datalist>
        </div>
      )}

      <Field
        id="subject"
        name="subject"
        label="Subject"
        value={subject}
        maxLength={SUBJECT_MAX}
        onChange={(e) => setSubject(e.target.value)}
        error={errors.subject}
        required
      />

      <div>
        <label htmlFor="body" className="block text-sm font-medium text-ink-800">
          Message
        </label>
        <textarea
          id="body"
          name="body"
          rows={7}
          value={body}
          maxLength={BODY_MAX}
          onChange={(e) => setBody(e.target.value)}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? "body-error" : "body-hint"}
          required
          className={cn(
            "mt-1.5 block w-full resize-y rounded-lg border-0 bg-transparent px-3 py-2 text-sm text-ink-900 ring-1 ring-inset placeholder:text-ink-400",
            "focus:ring-2 focus:ring-inset focus:outline-none",
            errors.body ? "ring-rose-300 focus:ring-rose-500" : "ring-ink-300 focus:ring-aurora-600",
          )}
        />
        {errors.body ? (
          <p id="body-error" className="mt-1.5 text-sm text-rose-600">
            {errors.body}
          </p>
        ) : (
          <p id="body-hint" className="mt-1.5 text-right text-xs text-ink-500">
            {body.length}/{BODY_MAX}
          </p>
        )}
      </div>

      <FormError message={error} />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending || !subject.trim() || !body.trim() || (to === "one" && !email.trim())}
          className={buttonClasses("primary")}
        >
          {pending && <Spinner />} {to === "all" ? "Send to everyone" : "Send message"}
        </button>
        {sent && (
          <span role="status" className="animate-fade-up text-sm text-emerald-600">
            {sent}
          </span>
        )}
      </div>
    </form>
  );
}
