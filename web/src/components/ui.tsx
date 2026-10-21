import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Severity, WebsiteStatus } from "@/lib/constants";

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export function buttonClasses(variant: ButtonVariant = "primary", size: ButtonSize = "md"): string {
  const variants: Record<ButtonVariant, string> = {
    primary: "bg-indigo-600 text-white shadow-sm hover:bg-indigo-500",
    secondary: "bg-white text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50",
    ghost: "text-slate-700 hover:bg-slate-100",
    danger: "bg-white text-rose-600 shadow-sm ring-1 ring-inset ring-rose-200 hover:bg-rose-50",
  };
  const sizes: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-sm",
    md: "px-4 py-2 text-sm",
    lg: "px-6 py-3 text-base",
  };
  return cn(
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-semibold transition",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600",
    "disabled:cursor-not-allowed disabled:opacity-60",
    variants[variant],
    sizes[size],
  );
}

export function ButtonLink({
  variant,
  size,
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link {...props} className={cn(buttonClasses(variant, size), className)} />;
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>{children}</div>;
}

type Tone = "gray" | "green" | "amber" | "red" | "indigo" | "blue";
const TONES: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700 ring-slate-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-800 ring-amber-200",
  red: "bg-rose-50 text-rose-700 ring-rose-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  blue: "bg-sky-50 text-sky-700 ring-sky-200",
};

export function Badge({ tone = "gray", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_LABELS: Record<WebsiteStatus, { label: string; tone: Tone }> = {
  pending_payment: { label: "Awaiting payment", tone: "amber" },
  active: { label: "Active", tone: "green" },
  past_due: { label: "Payment overdue", tone: "amber" },
  on_hold: { label: "On hold", tone: "red" },
  paused: { label: "Paused", tone: "gray" },
  cancelled: { label: "Cancelled", tone: "gray" },
  expired: { label: "Expired", tone: "gray" },
  payment_failed: { label: "Payment failed", tone: "red" },
};

export function StatusBadge({ status }: { status: WebsiteStatus }) {
  const { label, tone } = STATUS_LABELS[status] ?? { label: status, tone: "gray" as Tone };
  return <Badge tone={tone}>{label}</Badge>;
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const tone: Tone = severity === "high" ? "red" : severity === "medium" ? "amber" : "blue";
  return <Badge tone={tone}>{severity}</Badge>;
}

export function scoreColor(score: number): string {
  if (score >= 80) return "#059669";
  if (score >= 50) return "#d97706";
  return "#e11d48";
}

export function ScoreRing({ score, size = 64 }: { score: number | null; size?: number }) {
  const stroke = Math.max(4, Math.round(size / 12));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = score ?? 0;
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
        {score !== null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={scoreColor(value)}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - value / 100)}
          />
        )}
      </svg>
      <span className="absolute font-semibold text-slate-900" style={{ fontSize: Math.round(size / 3.4) }}>
        {score ?? "-"}
      </span>
      <span className="sr-only">{score === null ? "No score yet" : `AEO score ${score} out of 100`}</span>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card className="px-6 py-14 text-center">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{description}</p>
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-lg bg-slate-200/70", className)} />;
}

export function Notice({
  tone = "indigo",
  title,
  children,
  action,
}: {
  tone?: "indigo" | "amber" | "red" | "green" | "gray";
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    red: "border-rose-200 bg-rose-50 text-rose-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
    gray: "border-slate-200 bg-slate-50 text-slate-800",
  };
  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between", tones[tone])}>
      <div className="text-sm">
        <p className="font-semibold">{title}</p>
        {children && <div className="mt-0.5 opacity-90">{children}</div>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 font-bold tracking-tight text-slate-900">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-sm text-white shadow-sm">
        A
      </span>
      <span className="text-lg">
        AEO<span className="text-indigo-600">Go</span>
      </span>
    </Link>
  );
}

export function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className={cn("h-5 w-5", className)}>
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Escaping "<" prevents any string in the data from closing the script tag.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
