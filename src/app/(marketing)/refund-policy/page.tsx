import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "Refund Policy",
  description: "AEOGo's cancellation and refund policy.",
};

export default function RefundPolicyPage() {
  return (
    <ProsePage title="Refund Policy" updated="October 21, 2026">
      <p>We want you to be happy with AEOGo. This policy explains cancellations and refunds.</p>
      <h2>Cancel anytime</h2>
      <p>
        You can cancel a plan at any time from the website&apos;s page in your dashboard or through the billing portal.
        The plan stays active until the end of the current billing period and will not renew.
      </p>
      <h2>Refunds</h2>
      <ul>
        <li>
          If your first audit could not be completed because of a problem on our side, contact us within 14 days of
          purchase for a full refund.
        </li>
        <li>
          If you were charged twice for the same website, we will refund the duplicate charge in full.
        </li>
        <li>Other refund requests are reviewed case by case.</li>
      </ul>
      <h2>How refunds are paid</h2>
      <p>
        Refunds are issued through Dodo Payments, our merchant of record, to the original payment method. Depending on
        your bank, it can take 5 to 10 business days for the refund to appear.
      </p>
    </ProsePage>
  );
}
