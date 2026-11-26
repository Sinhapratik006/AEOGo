import { Faq, faqJsonLd } from "@/components/marketing/faq";
import { OptimizedForMarquee } from "@/components/marketing/optimized-for-marquee";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { AuroraBackdrop, ButtonLink, CheckIcon, JsonLd } from "@/components/ui";
import { appUrl } from "@/lib/env";

const STEPS = [
  {
    title: "Pick a plan and add your website",
    body: "Enter your URL and check out securely. No code, no plugins, no access to your site required.",
  },
  {
    title: "We audit 25+ AEO signals",
    body: "Our crawler reads your site the way AI crawlers do: robots.txt access, structured data, answer-first content, metadata, JavaScript dependence and more.",
  },
  {
    title: "Get fixes, not just a report",
    body: "AI-written titles and descriptions, a ready-to-upload llms.txt, a corrected robots.txt and schema markup. Re-audits then run automatically.",
  },
];

const FEATURES = [
  {
    title: "AI crawler access",
    body: "Find out instantly if robots.txt blocks GPTBot, ClaudeBot, PerplexityBot or OAI-SearchBot, and get a corrected file that keeps your private paths private.",
  },
  {
    title: "AI-written metadata",
    body: "Titles and meta descriptions rewritten from your actual page content, with anything unverifiable flagged for your review.",
  },
  {
    title: "llms.txt generator",
    body: "A curated map of your most important pages in the emerging llms.txt format, generated from your live site.",
  },
  {
    title: "Structured data checks",
    body: "Catch missing or broken JSON-LD on every page and get Organization and WebSite schema for your homepage.",
  },
  {
    title: "Answer-first content",
    body: "Spot pages that bury the answer, thin content, skipped headings and missing author or date signals.",
  },
  {
    title: "Continuous monitoring",
    body: "Automatic re-audits on your plan's schedule, with AEO score history and email reports when something changes.",
  },
];

const HERO_CHECKS = [
  { ok: true, text: "GPTBot, ClaudeBot and PerplexityBot allowed" },
  { ok: true, text: "llms.txt generated from 48 pages" },
  { ok: true, text: "18 titles and descriptions rewritten" },
  { ok: false, text: "3 pages need an answer-first intro" },
];

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
              Answer Engine Optimization on autopilot
            </p>
            <h1 className="animate-fade-up mt-6 text-4xl font-bold tracking-tight text-ink-950 [animation-delay:100ms] sm:text-5xl lg:text-6xl">
              Get your website recommended by <span className="text-aurora">AI answer engines</span>
            </h1>
            <p className="animate-fade-up mt-6 max-w-xl text-lg leading-relaxed text-ink-600 [animation-delay:200ms]">
              AEOGo crawls your site, finds everything that stops ChatGPT, Perplexity and Google AI from understanding
              and citing you, and writes the fixes for you. Then it keeps watching, automatically.
            </p>
            <div className="animate-fade-up mt-8 flex flex-wrap gap-3 [animation-delay:300ms]">
              <ButtonLink href="/signup" size="lg">
                Start optimizing
              </ButtonLink>
              <ButtonLink href="/pricing" size="lg" variant="secondary">
                See pricing
              </ButtonLink>
            </div>
            <p className="animate-fade-up mt-4 text-sm text-ink-500 [animation-delay:400ms]">Plans from $29/month per website · Cancel anytime</p>
          </div>

          <div className="animate-fade-up relative [animation-delay:250ms]">
            <div className="animate-glow-pulse absolute -inset-4 -z-10 rounded-3xl bg-linear-to-tr from-aurora-600/25 to-borealis-500/20 blur-2xl" />
            <div className="animate-float rounded-2xl border border-aurora-200/60 bg-surface/80 p-6 shadow-[0_30px_80px_-30px_var(--color-aurora-600)] backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-ink-500">yourwebsite.com</p>
                  <p className="text-lg font-semibold text-ink-900">AEO score</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-emerald-600">86</p>
                  <p className="text-xs font-medium text-emerald-600">+31 since first audit</p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-ink-100">
                <div className="animate-bar-grow h-full w-[86%] origin-left rounded-full bg-linear-to-r from-borealis-500 to-aurora-600 shadow-[0_0_12px_var(--color-aurora-600)]" />
              </div>
              <ul className="mt-6 space-y-3">
                {HERO_CHECKS.map((item, index) => (
                  <li
                    key={item.text}
                    className="animate-fade-up flex items-center gap-3 text-sm text-ink-700"
                    style={{ animationDelay: `${600 + index * 120}ms` }}
                  >
                    {item.ok ? (
                      <CheckIcon className="shrink-0 text-emerald-600" />
                    ) : (
                      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                        !
                      </span>
                    )}
                    {item.text}
                  </li>
                ))}
              </ul>
              <div className="mt-6 rounded-lg bg-ink-50 p-4 text-xs text-ink-600">
                <p className="font-semibold text-ink-800">Suggested title</p>
                <p className="mt-1 line-through decoration-rose-400">Home</p>
                <p className="mt-1 text-ink-900">Handmade Leather Wallets &amp; Bags | Atelier North</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <OptimizedForMarquee />

      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
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
      </section>

      <section id="features" className="scroll-mt-20 border-y border-ink-100 bg-ink-50/60">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="reveal text-3xl font-bold tracking-tight text-ink-950">Everything AI engines look for</h2>
          <p className="mt-3 max-w-2xl text-ink-600">
            Classic SEO tools optimize for blue links. AEOGo optimizes for being the answer.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="reveal card-glow rounded-2xl border border-ink-200 bg-surface p-6">
                <h3 className="font-semibold text-ink-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="reveal text-3xl font-bold tracking-tight text-ink-950">Simple pricing, per website</h2>
        <p className="mt-3 mb-10 max-w-2xl text-ink-600">
          Every plan includes the full audit, AI-written fixes and automatic monitoring. Pick how often and how deep.
        </p>
        <PricingCards />
      </section>

      <section id="faq" className="scroll-mt-20 border-y border-ink-100 bg-ink-50/60">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="reveal text-3xl font-bold tracking-tight text-ink-950">Frequently asked questions</h2>
          <div className="mt-8">
            <Faq />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="reveal relative isolate overflow-hidden rounded-3xl border border-aurora-200/70 bg-surface px-8 py-16 text-center shadow-[0_0_80px_-30px_var(--color-aurora-600)]">
          <AuroraBackdrop />
          <h2 className="text-3xl font-bold tracking-tight text-ink-950 sm:text-4xl">
            Be the answer <span className="text-aurora">AI gives</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-600">
            Your first AEO report and AI-written fixes are minutes away.
          </p>
          <ButtonLink href="/signup" size="lg" className="mt-8">
            Start optimizing your website
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
