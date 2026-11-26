"use client";

import { Logo } from "@/components/ui";

const ENGINES = ["ChatGPT", "Perplexity", "Claude", "Gemini", "Google AI Overviews", "Copilot"];

const engineBadge = (engine: string, hidden?: boolean) => (
  <span
    key={engine}
    className="shrink-0 whitespace-nowrap px-3 py-1.5 rounded-full border border-ink-200 bg-surface text-sm font-medium text-ink-600 transition hover:border-aurora-300 hover:text-aurora-700"
    aria-hidden={hidden}
  >
    {engine}
  </span>
);

export function OptimizedForMarquee() {
  return (
    <section aria-label="Supported answer engines" className="border-y border-ink-200 bg-surface/60">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mask-fade-x overflow-hidden">
          <div className="marquee-track flex items-center gap-6 animate-[marquee_24s_linear_infinite]">
            <span className="shrink-0 text-xs font-semibold tracking-wider text-ink-400 uppercase">
              Optimized for
            </span>
            <Logo />
            {ENGINES.map((engine) => engineBadge(engine))}
            {ENGINES.map((engine) => engineBadge(engine, true))}
          </div>
        </div>
      </div>
    </section>
  );
}
