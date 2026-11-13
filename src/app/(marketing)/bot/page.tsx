import type { Metadata } from "next";
import { ProsePage } from "@/components/marketing/prose-page";

export const metadata: Metadata = {
  title: "About AEOGoBot",
  description: "Information about AEOGoBot, the crawler that audits websites for AEOGo customers.",
};

export default function BotPage() {
  return (
    <ProsePage title="About AEOGoBot">
      <p>
        AEOGoBot is the crawler behind AEOGo. It visits a website only after the site&apos;s owner (or someone they
        authorized) subscribes to AEOGo and adds that website to their account.
      </p>
      <h2>How it identifies itself</h2>
      <p>
        Requests use a user agent containing <code>AEOGoBot/1.0</code> and a link to this page.
      </p>
      <h2>How it behaves</h2>
      <ul>
        <li>It only fetches public pages, robots.txt, sitemaps and llms.txt. It never submits forms or logs in.</li>
        <li>Requests are spaced out (and slowed further if robots.txt sets a crawl-delay for AEOGoBot).</li>
        <li>Each audit is limited to the page allowance of the customer&apos;s plan.</li>
        <li>It stops after repeated errors, so it never hammers a struggling server.</li>
      </ul>
      <h2>Questions or concerns</h2>
      <p>
        If you believe AEOGoBot is crawling your site without your authorization, contact us with your domain and we
        will investigate and stop it.
      </p>
    </ProsePage>
  );
}
