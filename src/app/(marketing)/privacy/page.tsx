import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How AEOGo collects, uses and protects your data.",
};

export default function PrivacyPage() {
  return (
    <ProsePage title="Privacy Policy" updated="October 21, 2026">
      <p>This policy explains what data AEOGo collects, why, and the choices you have.</p>
      <h2>Data we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> your name, email address and a securely hashed password (we never store
          passwords in plain text).
        </li>
        <li>
          <strong>Website data:</strong> the URLs you add and the publicly available content of those websites, which
          our crawler reads to produce your reports.
        </li>
        <li>
          <strong>Billing data:</strong> subscription status and identifiers from Dodo Payments. Card details are
          handled entirely by Dodo Payments and never reach our servers.
        </li>
        <li>
          <strong>Technical data:</strong> IP address and browser user agent for sign-in sessions and abuse prevention.
        </li>
      </ul>
      <h2>How we use it</h2>
      <p>
        To provide the service (audits, reports and suggested fixes), to process payments, to send service emails such
        as reports and password resets, and to keep the service secure. We do not sell your data.
      </p>
      <h2>Service providers</h2>
      <p>
        We use Dodo Payments for payments, an email delivery provider for transactional email, and Anthropic to
        generate AI-written suggestions from your public page content. Each processes data only to provide its service
        to us.
      </p>
      <h2>Retention</h2>
      <p>
        Account data is kept while your account is open. Detailed crawl data is kept for your most recent audits; audit
        scores are kept for your history. You can delete a website without an active plan from your dashboard, or ask
        us to delete your account.
      </p>
      <h2>Your rights</h2>
      <p>
        Depending on where you live you may have the right to access, correct, export or delete your personal data.
        Contact us to exercise these rights.
      </p>
    </ProsePage>
  );
}
