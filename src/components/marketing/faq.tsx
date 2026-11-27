export const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: "What is AEO (Answer Engine Optimization)?",
    answer:
      "AEO is the practice of making your website easy for AI assistants such as ChatGPT, Perplexity, Claude, Gemini and Google AI Overviews to read, understand and cite. It covers crawler access, structured data, clear answer-first content and accurate metadata.",
  },
  {
    question: "What's the difference between AEO, SEO and GEO?",
    answer:
      "SEO (Search Engine Optimization) gets your pages crawled, indexed and ranked by Google and Bing: sitemaps, canonicals, titles, descriptions, headings, speed, HTTPS and mobile. AEO (Answer Engine Optimization) makes sure AI assistants can reach your site and pull a direct answer from it. GEO (Generative Engine Optimization) makes your content trustworthy and quotable enough for ChatGPT, Perplexity, Gemini and AI Overviews to cite: statistics, sources, author and date signals, lists and a clearly defined brand. AEOGo scores all three separately in every audit.",
  },
  {
    question: "Do I still need a separate SEO tool?",
    answer:
      "For most sites, no. Every AEOGo audit includes a full technical and on-page SEO report with its own score, plus AI-written titles and meta descriptions. If you need keyword rank tracking or backlink research, a dedicated tool still helps; AEOGo focuses on everything you can fix on your own site.",
  },
  {
    question: "What happens after I subscribe?",
    answer:
      "You enter your website address and check out. As soon as the payment is confirmed, our crawler starts auditing your site. Your first report, including AI-written fixes, is usually ready within 5 to 15 minutes depending on the size of your site. After that, audits run automatically on your plan's schedule.",
  },
  {
    question: "Does AEOGo change my website?",
    answer:
      "No. AEOGo never logs in to or edits your site. Every fix is a ready-to-paste suggestion (titles, descriptions, robots.txt, llms.txt and schema markup) that you or your developer review and publish.",
  },
  {
    question: "Does it work with WordPress, Shopify, Webflow or custom sites?",
    answer:
      "Yes. AEOGo reads your public website the same way AI crawlers do, so it works with any platform or framework.",
  },
  {
    question: "Can I cancel at any time?",
    answer:
      "Yes. Cancel from your dashboard in one click. Your plan stays active until the end of the current billing period and you keep access to your reports.",
  },
  {
    question: "How are payments handled?",
    answer:
      "Payments are processed securely by Dodo Payments, our merchant of record, which also handles sales tax, VAT and invoices. We never see or store your card details.",
  },
  {
    question: "I have more than one website. How does pricing work?",
    answer:
      "Each plan covers one website. You can add as many websites as you like to your account, each with the plan that fits it.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-ink-200 rounded-2xl border border-ink-200 bg-surface">
      {FAQ_ITEMS.map((item) => (
        <details key={item.question} className="group px-6 py-5 transition-colors open:bg-aurora-50/40 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-ink-900">{item.question}</h3>
            <span className="text-xl leading-none text-ink-400 transition duration-300 group-open:rotate-45 group-open:text-aurora-600" aria-hidden="true">
              +
            </span>
          </summary>
          <p className="mt-3 animate-fade-up text-sm leading-relaxed text-ink-600">{item.answer}</p>
        </details>
      ))}
    </div>
  );
}

export function faqJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  };
}
