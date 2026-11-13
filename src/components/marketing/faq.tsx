export const FAQ_ITEMS: Array<{ question: string; answer: string }> = [
  {
    question: "What is AEO (Answer Engine Optimization)?",
    answer:
      "AEO is the practice of making your website easy for AI assistants such as ChatGPT, Perplexity, Claude, Gemini and Google AI Overviews to read, understand and cite. It covers crawler access, structured data, clear answer-first content and accurate metadata.",
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
    <div className="divide-y divide-slate-200 rounded-2xl border border-slate-200 bg-white">
      {FAQ_ITEMS.map((item) => (
        <details key={item.question} className="group px-6 py-5 [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
            <h3 className="text-base font-semibold text-slate-900">{item.question}</h3>
            <span className="text-xl leading-none text-slate-400 transition group-open:rotate-45" aria-hidden="true">
              +
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">{item.answer}</p>
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
