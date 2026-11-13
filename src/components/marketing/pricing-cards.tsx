import { auditIntervalLabel, PLAN_LIST } from "@/lib/plans";
import { Badge, ButtonLink, CheckIcon, cn } from "../ui";

export function PricingCards() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {PLAN_LIST.map((plan) => (
        <div
          key={plan.id}
          className={cn(
            "relative flex flex-col rounded-2xl border bg-white p-8 shadow-sm",
            plan.highlighted ? "border-indigo-600 ring-1 ring-indigo-600" : "border-slate-200",
          )}
        >
          {plan.highlighted && (
            <Badge tone="indigo" className="absolute -top-3 left-8 bg-indigo-600 text-white ring-indigo-600">
              Most popular
            </Badge>
          )}
          <h3 className="text-lg font-semibold text-slate-900">{plan.name}</h3>
          <p className="mt-1 min-h-10 text-sm text-slate-600">{plan.tagline}</p>
          <p className="mt-6 flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight text-slate-900">{`$${plan.priceMonthly}`}</span>
            <span className="text-sm text-slate-500">/month per website</span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {auditIntervalLabel(plan.auditIntervalHours)} audits · up to {plan.maxPages.toLocaleString("en-US")} pages
          </p>
          <ButtonLink
            href={`/signup?plan=${plan.id}`}
            variant={plan.highlighted ? "primary" : "secondary"}
            className="mt-6 w-full"
          >
            Start with {plan.name}
          </ButtonLink>
          <ul className="mt-8 space-y-3 text-sm text-slate-700">
            {plan.features.map((feature) => (
              <li key={feature} className="flex gap-2.5">
                <CheckIcon className="mt-px shrink-0 text-indigo-600" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
