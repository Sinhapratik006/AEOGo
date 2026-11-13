import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of AEOGo.",
};

export default function TermsPage() {
  return (
    <ProsePage title="Terms of Service" updated="October 21, 2026">
      <p>
        These terms govern your use of AEOGo (&quot;we&quot;, &quot;us&quot;), an automated Answer Engine Optimization
        service. By creating an account or purchasing a plan you agree to them.
      </p>
      <h2>The service</h2>
      <p>
        AEOGo crawls the public pages of websites you add to your account, reports issues that affect how AI answer
        engines read your site, and generates suggested fixes. Suggestions are provided as drafts for you to review;
        we never modify your website. AI-generated content can contain mistakes, so review every suggestion before
        publishing it.
      </p>
      <h2>Your responsibilities</h2>
      <ul>
        <li>You may only add websites that you own or are authorized to have audited.</li>
        <li>You are responsible for keeping your account credentials secure.</li>
        <li>You may not use the service to overload, attack or scrape third-party websites.</li>
      </ul>
      <h2>Plans, billing and cancellation</h2>
      <p>
        Plans are billed monthly per website in advance. Payments are processed by Dodo Payments, which acts as our
        merchant of record and handles applicable taxes. You can cancel at any time from your dashboard; your plan
        remains active until the end of the paid billing period and is not renewed afterwards. See our{" "}
        <Link href="/refund-policy">refund policy</Link> for refunds.
      </p>
      <h2>Availability</h2>
      <p>
        We aim to keep AEOGo available and accurate, but the service is provided &quot;as is&quot; without warranties of
        any kind. Search and AI engines decide independently what to show; we can&apos;t guarantee rankings, citations
        or traffic.
      </p>
      <h2>Liability</h2>
      <p>
        To the maximum extent permitted by law, our total liability for any claim relating to the service is limited
        to the amount you paid us in the 12 months before the claim.
      </p>
      <h2>Changes</h2>
      <p>
        We may update these terms. If a change is material we will notify you by email before it takes effect.
        Continued use after that date means you accept the updated terms.
      </p>
    </ProsePage>
  );
}
