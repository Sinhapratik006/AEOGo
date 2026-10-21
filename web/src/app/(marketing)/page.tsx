import { Faq, faqJsonLd } from "@/components/marketing/faq";
import { PricingCards } from "@/components/marketing/pricing-cards";
import { ButtonLink, CheckIcon, JsonLd } from "@/components/ui";
import { appUrl } from "@/lib/env";

const ENGINES = ["ChatGPT", "Perplexity", "Claude", "Gemini", "Google AI Overviews", "Copilot"];

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

      <section className="relative overflow-hidden bg-gradient-to-b from-indigo-50/80 via-white to-white">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:px-6 lg:grid-cols-2 lg:pt-24">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-indigo-700 shadow-sm ring-1 ring-indigo-100">
              Answer Engine Optimization on autopilot
            </p>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
              Get your website recommended by <span className="text-indigo-600">AI answer engines</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
              AEOGo crawls your site, finds everything that stops ChatGPT, Perplexity and Google AI from understanding
              and citing you, and writes the fixes for you. Then it keeps watching, automatically.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <ButtonLink href="/signup" size="lg">
                Start optimizing
              </ButtonLink>
              <ButtonLink href="/pricing" size="lg" variant="secondary">
                See pricing
              </ButtonLink>
            </div>
            <p className="mt-4 text-sm text-slate-500">Plans from $29/month per website · Cancel anytime</p>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-tr from-indigo-200/60 to-violet-200/40 blur-2xl" />
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-500">yourwebsite.com</p>
                  <p className="text-lg font-semibold text-slate-900">AEO score</p>
                </div>
                <div className="text-right">
                  <p className="text-4xl font-bold text-emerald-600">86</p>
                  <p className="text-xs font-medium text-emerald-600">+31 since first audit</p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-[86%] rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500" />
              </div>
              <ul className="mt-6 space-y-3">
                {HERO_CHECKS.map((item) => (
                  <li key={item.text} className="flex items-center gap-3 text-sm text-slate-700">
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
              <div className="mt-6 rounded-lg bg-slate-50 p-4 text-xs text-slate-600">
                <p className="font-semibold text-slate-800">Suggested title</p>
                <p className="mt-1 line-through decoration-rose-400">Home</p>
                <p className="mt-1 text-slate-900">Handmade Leather Wallets &amp; Bags | Atelier North</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section aria-label="Supported answer engines" className="border-y border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 px-4 py-6 sm:px-6">
          <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Optimized for</span>
          {ENGINES.map((engine) => (
            <span key={engine} className="text-sm font-semibold text-slate-600">
              {engine}
            </span>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">How AEOGo works</h2>
        <p className="mt-3 max-w-2xl text-slate-600">
          Buy a plan, give us your website address, and the automation takes it from there.
        </p>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                {index + 1}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section id="features" className="scroll-mt-20 bg-slate-50">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Everything AI engines look for</h2>
          <p className="mt-3 max-w-2xl text-slate-600">
            Classic SEO tools optimize for blue links. AEOGo optimizes for being the answer.
          </p>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-6">
                <h3 className="font-semibold text-slate-900">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Simple pricing, per website</h2>
        <p className="mt-3 mb-10 max-w-2xl text-slate-600">
          Every plan includes the full audit, AI-written fixes and automatic monitoring. Pick how often and how deep.
        </p>
        <PricingCards />
      </section>

      <section id="faq" className="scroll-mt-20 bg-slate-50">
        <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Frequently asked questions</h2>
          <div className="mt-8">
            <Faq />
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="rounded-3xl bg-gradient-to-br from-indigo-600 to-violet-600 px-8 py-14 text-center shadow-xl">
          <h2 className="text-3xl font-bold tracking-tight text-white">Be the answer AI gives</h2>
          <p className="mx-auto mt-3 max-w-xl text-indigo-100">
            Your first AEO report and AI-written fixes are minutes away.
          </p>
          <ButtonLink href="/signup" size="lg" variant="secondary" className="mt-8">
            Start optimizing your website
          </ButtonLink>
        </div>
      </section>
    </>
  );
}
