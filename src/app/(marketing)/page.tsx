import { Faq, faqJsonLd } from "@/components/marketing/faq";
import { OptimizedForMarquee } from "@/components/marketing/optimized-for-marquee";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { AuroraBackdrop, ButtonLink, CheckIcon, JsonLd } from "@/components/ui";
import { appUrl } from "@/lib/env";

type PillarId = "aeo" | "seo" | "geo";

/* Literal class strings per pillar, so Tailwind picks them up. */
const PILLAR_STYLE: Record<PillarId, { chip: string; bar: string; text: string; ring: string; glow: string }> = {
  aeo: {
    chip: "bg-aurora-50 text-aurora-700 ring-aurora-200",
    bar: "from-aurora-400 to-aurora-600",
    text: "text-aurora-700",
    ring: "hover:border-aurora-300",
    glow: "shadow-[0_0_40px_-18px_var(--color-aurora-600)]",
  },
  seo: {
    chip: "bg-borealis-50 text-borealis-700 ring-borealis-200",
    bar: "from-borealis-400 to-borealis-600",
    text: "text-borealis-700",
    ring: "hover:border-borealis-300",
    glow: "shadow-[0_0_40px_-18px_var(--color-borealis-500)]",
  },
  geo: {
    chip: "bg-green-50 text-green-700 ring-green-200",
    bar: "from-green-200 to-green-700",
    text: "text-green-700",
    ring: "hover:border-green-200",
    glow: "shadow-[0_0_40px_-18px_var(--color-green-700)]",
  },
};

const PILLARS: Array<{
  id: PillarId;
  short: string;
  name: string;
  question: string;
  engines: string;
  checks: string[];
  fixes: string[];
}> = [
  {
    id: "aeo",
    short: "AEO",
    name: "Answer Engine Optimization",
    question: "Can AI assistants reach your site and pull a direct answer from it?",
    engines: "ChatGPT · Claude · Perplexity",
    checks: [
      "GPTBot, ClaudeBot, PerplexityBot and OAI-SearchBot access",
      "llms.txt and content that renders without JavaScript",
      "Answer-first intros, question headings and thin pages",
      "Missing or broken JSON-LD structured data",
    ],
    fixes: [
      "Corrected robots.txt that keeps private paths private",
      "Ready-to-upload llms.txt built from your live pages",
      "Organization and WebSite schema for your homepage",
    ],
  },
  {
    id: "seo",
    short: "SEO",
    name: "Search Engine Optimization",
    question: "Is your site set up to be crawled, indexed and ranked by Google?",
    engines: "Google · Bing",
    checks: [
      "Sitemap, robots.txt, noindex and canonical URLs",
      "Missing, duplicate or badly sized titles and descriptions",
      "H1s, heading order, image alt text and internal links",
      "HTTPS, mixed content, redirects, speed, mobile and page size",
    ],
    fixes: [
      "AI-written titles and meta descriptions from your real content",
      "Every duplicate and missing tag listed page by page",
      "Plain-English steps for each technical issue",
    ],
  },
  {
    id: "geo",
    short: "GEO",
    name: "Generative Engine Optimization",
    question: "Will generative engines trust your pages enough to quote and cite them?",
    engines: "Google AI Overviews · Gemini · Perplexity",
    checks: [
      "Statistics, concrete numbers and cited sources",
      "Author and date trust signals",
      "Lists, tables and short, quotable paragraphs",
      "Brand entity defined and linked to its profiles (sameAs)",
    ],
    fixes: [
      "Organization schema that defines your brand, ready to paste",
      "A real AI visibility test: is your brand found and cited?",
      "A prioritized action plan for citation-worthy content",
    ],
  },
];

const HERO_SCORES: Array<{ id: PillarId; label: string; score: number; width: string }> = [
  { id: "aeo", label: "AEO", score: 86, width: "w-[86%]" },
  { id: "seo", label: "SEO", score: 92, width: "w-[92%]" },
  { id: "geo", label: "GEO", score: 74, width: "w-[74%]" },
];

const HERO_CHECKS: Array<{ ok: boolean; pillar: PillarId; text: string }> = [
  { ok: true, pillar: "aeo", text: "GPTBot, ClaudeBot and PerplexityBot allowed" },
  { ok: true, pillar: "seo", text: "18 titles and descriptions rewritten" },
  { ok: true, pillar: "geo", text: "Brand defined with Organization schema" },
  { ok: false, pillar: "geo", text: "3 pages need stats or cited sources" },
];

const STEPS = [
  {
    title: "Pick a plan and add your website",
    body: "Enter your URL and check out securely. No code, no plugins, no access to your site required.",
  },
  {
    title: "We run 45+ AEO, SEO and GEO checks",
    body: "Our crawler reads your site the way Google and AI crawlers do, then scores it three ways: answer engines, classic search and generative engines.",
  },
  {
    title: "Get fixes, not just a report",
    body: "AI-written titles and descriptions, a ready-to-upload llms.txt, a corrected robots.txt and schema markup. Re-audits then run automatically.",
  },
];

const FEATURES: Array<{ title: string; body: string; pillars: PillarId[] }> = [
  {
    title: "AI-written metadata",
    body: "Titles and meta descriptions rewritten from your actual page content, with anything unverifiable flagged for your review.",
    pillars: ["seo", "aeo"],
  },
  {
    title: "Corrected robots.txt",
    body: "Unblock AI answer engines and fix crawl rules without exposing the paths you want kept private.",
    pillars: ["aeo", "seo"],
  },
  {
    title: "llms.txt generator",
    body: "A curated map of your most important pages in the emerging llms.txt format, generated from your live site.",
    pillars: ["aeo"],
  },
  {
    title: "Schema markup",
    body: "Organization and WebSite JSON-LD for your homepage, so search and AI engines know exactly who you are.",
    pillars: ["aeo", "seo", "geo"],
  },
  {
    title: "Real AI visibility test",
    body: "We ask AI search the questions your customers ask, and show whether it finds, knows and cites your site, and who it cites instead.",
    pillars: ["geo", "aeo"],
  },
  {
    title: "Continuous monitoring",
    body: "Automatic re-audits on your plan's schedule, with AEO, SEO and GEO scores tracked side by side and email reports.",
    pillars: ["aeo", "seo", "geo"],
  },
];

function PillarChip({ id, className = "" }: { id: PillarId; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ring-1 ${PILLAR_STYLE[id].chip} ${className}`}>
      {id.toUpperCase()}
    </span>
  );
}

export default function HomePage() {
  const base = appUrl();
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "@id": `${base}/#organization`, name: "AEOGo", url: `${base}/` },
            {
              "@type": "WebSite",
              "@id": `${base}/#website`,
              name: "AEOGo",
              url: `${base}/`,
              publisher: { "@id": `${base}/#organization` },
            },
          ],
        }}
      />
      <JsonLd data={faqJsonLd()} />

      <section className="relative isolate overflow-hidden">
        <AuroraBackdrop grid />
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-24">
          <div>
            <p className="animate-fade-up inline-flex items-center gap-2 rounded-full bg-aurora-50/80 px-3 py-1 text-xs font-semibold text-aurora-700 ring-1 ring-aurora-200 backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-aurora-600 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-aurora-600" />
              </span>
              AEO, SEO &amp; GEO on autopilot
            </p>
            <h1 className="animate-fade-up mt-6 text-4xl font-bold tracking-tight text-ink-950 [animation-delay:100ms] sm:text-5xl lg:text-6xl">
              Rank on Google. <span className="text-aurora">Get cited by AI.</span>
            </h1>
            <p className="animate-fade-up mt-6 max-w-xl text-lg leading-relaxed text-ink-600 [animation-delay:200ms]">
              AEOGo audits your site for answer engines, search engines and generative engines in one pass, finds
              everything that stops Google, ChatGPT and Perplexity from ranking and citing you, and writes the fixes.
              Then it keeps watching, automatically.
            </p>
            <div className="animate-fade-up mt-6 flex flex-wrap gap-2 [animation-delay:250ms]">
              {PILLARS.map((p) => (
                <span key={p.id} className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${PILLAR_STYLE[p.id].chip}`}>
                  <span className="font-bold">{p.short}</span>
                  <span className="opacity-80">{p.name.replace(" Optimization", "")}</span>
                </span>
              ))}
            </div>
            <div className="animate-fade-up mt-8 flex flex-wrap gap-3 [animation-delay:300ms]">
              <ButtonLink href="/signup" size="lg">
                Start optimizing
              </ButtonLink>
              <ButtonLink href="#aeo-seo-geo" size="lg" variant="secondary">
                See what we fix
              </ButtonLink>
            </div>
            <p className="animate-fade-up mt-4 text-sm text-ink-500 [animation-delay:400ms]">Free plan available · Paid plans from $19/month per website · Cancel anytime</p>
          </div>

          <div className="animate-fade-up relative [animation-delay:250ms]">
            <div className="animate-glow-pulse absolute -inset-4 -z-10 rounded-3xl bg-linear-to-tr from-aurora-600/25 to-borealis-500/20 blur-2xl" />
            <div className="animate-float rounded-2xl border border-aurora-200/60 bg-surface/80 p-6 shadow-[0_30px_80px_-30px_var(--color-aurora-600)] backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-500">yourwebsite.com</p>
                  <p className="text-lg font-semibold text-ink-900">Visibility report</p>
                </div>
                <p className="rounded-full bg-aurora-50 px-2.5 py-1 text-xs font-medium text-aurora-700 ring-1 ring-aurora-200">+31 since first audit</p>
              </div>

              <ul className="mt-5 space-y-3">
                {HERO_SCORES.map((s, index) => (
                  <li key={s.id} className="grid grid-cols-[2.75rem_1fr_2rem] items-center gap-3">
                    <PillarChip id={s.id} className="justify-center" />
                    <div className="h-2 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={`animate-bar-grow h-full origin-left rounded-full bg-linear-to-r ${PILLAR_STYLE[s.id].bar} ${s.width}`}
                        style={{ animationDelay: `${300 + index * 150}ms` }}
                      />
                    </div>
                    <span className={`text-right text-lg font-bold ${PILLAR_STYLE[s.id].text}`}>{s.score}</span>
                  </li>
                ))}
              </ul>

              <ul className="mt-6 space-y-3 border-t border-ink-100 pt-5">
                {HERO_CHECKS.map((item, index) => (
                  <li
                    key={item.text}
                    className="animate-fade-up flex items-center gap-3 text-sm text-ink-700"
                    style={{ animationDelay: `${700 + index * 120}ms` }}
                  >
                    {item.ok ? (
                      <CheckIcon className="shrink-0 text-emerald-600" />
                    ) : (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                        !
                      </span>
                    )}
                    <span className="min-w-0 flex-1">{item.text}</span>
                    <PillarChip id={item.pillar} />
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-lg bg-ink-50 p-4 text-xs text-ink-600">
                <p className="flex items-center justify-between font-semibold text-ink-800">
                  Suggested title <PillarChip id="seo" />
                </p>
                <p className="mt-1 line-through decoration-rose-400">Home</p>
                <p className="mt-1 text-ink-900">Handmade Leather Wallets &amp; Bags | Atelier North</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <OptimizedForMarquee />

      <section id="aeo-seo-geo" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="reveal text-3xl font-bold tracking-tight text-ink-950">One audit. Three scores. Every fix.</h2>
        <p className="mt-3 max-w-2xl text-ink-600">
          Classic search, AI answers and generative citations reward different things. AEOGo checks all three
          separately, so you know exactly what to fix for each, and no issue is counted twice.
        </p>
        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {PILLARS.map((p) => {
            const style = PILLAR_STYLE[p.id];
            return (
              <article
                key={p.id}
                className={`reveal card-glow flex flex-col rounded-2xl border border-ink-200 bg-surface p-6 transition-colors ${style.ring} ${style.glow}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-lg px-2.5 py-1 text-sm font-bold ring-1 ${style.chip}`}>{p.short}</span>
                  <span className="text-right text-xs text-ink-500">{p.engines}</span>
                </div>
                <h3 className="mt-4 text-lg font-semibold text-ink-900">{p.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{p.question}</p>

                <p className="mt-6 text-xs font-semibold tracking-wide text-ink-500 uppercase">What we check</p>
                <ul className="mt-3 space-y-2">
                  {p.checks.map((check) => (
                    <li key={check} className="flex gap-2 text-sm text-ink-700">
                      <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-current ${style.text}`} aria-hidden="true" />
                      {check}
                    </li>
                  ))}
                </ul>

                <p className="mt-6 text-xs font-semibold tracking-wide text-ink-500 uppercase">What we fix for you</p>
                <ul className="mt-3 space-y-2 rounded-xl bg-ink-50 p-4">
                  {p.fixes.map((fix) => (
                    <li key={fix} className="flex gap-2 text-sm text-ink-800">
                      <CheckIcon className={`mt-0.5 shrink-0 ${style.text}`} />
                      {fix}
                    </li>
                  ))}
                </ul>
              </article>
            );
          })}
        </div>
      </section>

      <section id="how-it-works" className="scroll-mt-20 border-y border-ink-100 bg-ink-50/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="reveal text-3xl font-bold tracking-tight text-ink-950">How AEOGo works</h2>
          <p className="mt-3 max-w-2xl text-ink-600">
            Buy a plan, give us your website address, and the automation takes it from there.
          </p>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="reveal card-glow rounded-2xl border border-ink-200 bg-surface p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-aurora-600 text-sm font-bold text-on-accent shadow-[0_0_18px_-2px_var(--color-aurora-600)]">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="reveal text-3xl font-bold tracking-tight text-ink-950">Fixes, not just a report</h2>
        <p className="mt-3 max-w-2xl text-ink-600">
          SEO tools optimize for blue links. AEO tools optimize for AI answers. AEOGo does both, plus the trust signals
          generative engines need before they cite you.
        </p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="reveal card-glow rounded-2xl border border-ink-200 bg-surface p-6">
              <div className="flex flex-wrap gap-1.5">
                {feature.pillars.map((id) => (
                  <PillarChip key={id} id={id} />
                ))}
              </div>
              <h3 className="mt-3 font-semibold text-ink-900">{feature.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="scroll-mt-20 border-y border-ink-100 bg-ink-50/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="reveal text-3xl font-bold tracking-tight text-ink-950">Simple pricing, per website</h2>
          <p className="mt-3 mb-10 max-w-2xl text-ink-600">
            Every plan includes the full AEO, SEO and GEO audit, fixes and automatic monitoring. Pick how often and how deep.
          </p>
          <PricingCards />
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="reveal text-3xl font-bold tracking-tight text-ink-950">Frequently asked questions</h2>
        <div className="mt-8">
          <Faq />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div className="reveal relative isolate overflow-hidden rounded-3xl border border-aurora-200/70 bg-surface px-8 py-16 text-center shadow-[0_0_80px_-30px_var(--color-aurora-600)]">
          <AuroraBackdrop />
          <h2 className="text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
            Be the result Google ranks and <span className="text-aurora">the answer AI gives</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-600">
            Your first AEO, SEO and GEO report, with fixes, is minutes away.
          </p>
          <ButtonLink href="/signup" size="lg" className="mt-8">
            Start optimizing your website
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
