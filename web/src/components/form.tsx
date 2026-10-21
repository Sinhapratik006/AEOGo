import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "./ui";

export function Field({
  label,
  error,
  hint,
  className,
  id,
  ...input
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null; hint?: ReactNode; id: string }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        {...input}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={cn(
          "mt-1.5 block w-full rounded-lg border-0 px-3 py-2 text-sm text-slate-900 shadow-sm ring-1 ring-inset placeholder:text-slate-400",
          "focus:ring-2 focus:ring-inset focus:outline-none disabled:bg-slate-50",
          error ? "ring-rose-300 focus:ring-rose-500" : "ring-slate-300 focus:ring-indigo-600",
        )}
      />
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-sm text-rose-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {message}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-4 w-4 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
