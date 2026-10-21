# AEOGo web app

Full-stack SaaS for automated Answer Engine Optimization (AEO): marketing site, auth,
Dodo Payments subscriptions, a customer dashboard, and a background worker that audits
each customer's website and writes the fixes.

**Flow:** a customer signs up → enters their website URL and picks a plan → pays on Dodo's
hosted checkout → the subscription activates (via webhook, or verified directly with Dodo
on the return page) → the worker crawls the site, scores it, and generates fixes → audits
repeat automatically on the plan's schedule for as long as the subscription is active.

## Stack

| Part | Tech |
| --- | --- |
| Frontend + API | Next.js 16 (App Router, Cache Components, Route Handlers), React 19, Tailwind CSS 4 |
| Automation | Node.js worker (`worker/index.ts`) with a Postgres-backed job queue |
| Database | PostgreSQL + Drizzle ORM (SQL migrations in `drizzle/`) |
| Auth | Email + password (scrypt), database sessions in HttpOnly cookies, password reset |
| Payments | Dodo Payments: checkout sessions, Standard Webhooks, customer portal |
| AI fixes | Anthropic Claude (optional) with structured outputs |
| Email | Resend (optional; printed to the log when not configured) |

## Run it locally

Requirements: Node.js 20.12+ and PostgreSQL 14+ (UTF-8). Commands run from this `web/` folder.

```bash
npm install
cp .env.example .env.local        # then fill in the values (see below)
docker compose up -d              # local Postgres, or point DATABASE_URL at Neon/Supabase
npm run db:migrate                # create the tables
npm run dev                       # web app on http://localhost:3000 + the worker
```

`npm run dev` starts **both** the Next.js app and the worker. Audits only run while the
worker is running.

> Windows PowerShell may block `npm` with an execution-policy error. Use `npm.cmd`
> instead (e.g. `npm.cmd run dev`) or run the commands from Command Prompt.

## Set up Dodo Payments

Start in **test mode** (`DODO_PAYMENTS_ENVIRONMENT=test_mode`) and switch to `live_mode`
when you're ready to take real payments.

1. **Products** (Dashboard → Products → Create): create three **subscription** products,
   e.g. "AEOGo Starter" $29, "AEOGo Growth" $79, "AEOGo Pro" $199, billed every 1 month.
   Set the **subscription period longer than the billing frequency** (e.g. 10 years). If
   they're equal, Dodo ends the subscription after a single charge. Copy each product id
   (`pdt_...`) into `DODO_PRODUCT_ID_STARTER`, `DODO_PRODUCT_ID_GROWTH` and `DODO_PRODUCT_ID_PRO`.
2. **API key** (Developer → API Keys): put it in `DODO_PAYMENTS_API_KEY`.
3. **Webhook** (Developer → Webhooks → Add endpoint):
   - URL: `https://YOUR_DOMAIN/api/webhooks/dodo`
   - Events: all `subscription.*` events and `payment.succeeded`
   - Copy the signing secret (`whsec_...`) into `DODO_PAYMENTS_WEBHOOK_KEY`.
4. Make sure `APP_URL` is your public URL. It's used for the checkout return URL.

Prices shown on the site come from `src/lib/plans.ts`; the amount actually charged comes
from the Dodo product. Keep the two in sync, along with plan limits (pages per audit,
audit frequency, AI fixes per audit).

**Local development without a public URL:** webhooks can't reach `localhost`, but you don't
need them to test. After paying with a Dodo test card you're sent back to
`/dashboard/checkout/<websiteId>`, which verifies the payment directly with the Dodo API
and activates the subscription. Lifecycle changes made later in Dodo (renewals,
cancellations, failed payments) need the webhook, so use a tunnel (e.g. ngrok) or the Dodo
CLI (`dodo wh listen`) to receive them locally.

## How the billing integration works

- **Checkout:** `POST /api/websites` validates the URL (DNS, public IP, reachability), saves
  the website as `pending_payment`, then creates a Dodo checkout session with the website
  id, user id and plan in `metadata`, and stores the session id.
- **Activation:** `subscription.*` webhooks are signature-verified, deduplicated by
  `webhook-id`, and applied with row locks. A subscription is matched to a website by an
  existing link, by our stored checkout session (`payment.succeeded`), or by metadata.
- **Lifecycle:** `active` and `past_due` run the automation; `on_hold`, `paused`,
  `cancelled`, `expired` and `failed` stop it. Customers cancel at period end from the
  dashboard, and manage cards and invoices in the Dodo customer portal.
- **Edge cases handled:** duplicate payments for one website are flagged on the billing page,
  a website removed before its payment completed is restored, and stale or replayed
  webhooks are rejected.

## What the automation does

Each audit (worker) crawls up to the plan's page limit and checks:

- AI crawler access in robots.txt (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot,
  PerplexityBot and others), sitemaps and llms.txt
- Titles, meta descriptions, canonical tags, noindex, H1 and heading structure, image alt text
- JSON-LD validity and presence, thin content, answer-first intros, author/date signals
- Content that only appears with JavaScript (invisible to most AI crawlers)

It then writes fixes: a corrected robots.txt (keeping existing path rules), an llms.txt
built from the site's pages, Organization/WebSite JSON-LD, and (with `ANTHROPIC_API_KEY`)
AI-written titles and descriptions grounded in each page's text. Claims the model can't
support are flagged for review. **Fixes are suggestions only; the site is never modified.**

The worker claims jobs with `FOR UPDATE SKIP LOCKED`, so you can run several worker
processes. It prioritizes Pro sites, re-queues audits interrupted by a crash, schedules
recurring audits, and prunes old crawl detail. Crawling is SSRF-protected: every
connection is checked against private, loopback and metadata IP ranges at connect time.

## Deploy

You need three things: the Next.js app, the always-on worker, and Postgres. Set the same
environment variables for the app and the worker.

```bash
npm ci
npm run build
npm run db:migrate      # on every deploy, before starting the new version
npm run start           # web app (PORT defaults to 3000)
npm run worker          # worker, as a separate process/service
```

- **Single server / Railway / Render / Fly.io:** run the web app and the worker as two
  services from this folder, or one service with `npm run start:all`.
- **Vercel + a worker host:** deploy the app to Vercel (root directory `web`) and run
  `npm run worker` on Railway, Render or Fly.io, sharing one database (e.g. Neon).

Production checklist: `APP_URL` uses `https://` (enables Secure cookies), the Dodo webhook
points at the production URL, `DODO_PAYMENTS_ENVIRONMENT=live_mode` with live keys and live
product ids, and `RESEND_API_KEY`/`EMAIL_FROM` are set so password resets reach users. If
you run behind Cloudflare or Fly.io, set `TRUSTED_IP_HEADER` for accurate rate limiting.
Review the Terms, Privacy and Refund pages (`src/app/(marketing)`) before going live;
Dodo checks them during merchant verification.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Next.js dev server + worker (auto-restart) |
| `npm run build` / `npm run start` | Production build / server |
| `npm run worker` | Run the automation worker |
| `npm run start:all` | Production server + worker in one process group |
| `npm run db:migrate` | Apply migrations |
| `npm run db:generate` | Create a migration after editing `src/db/schema.ts` |
| `npm run db:studio` | Browse the database |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |

## Project layout

```
src/app/(marketing)     landing, pricing, legal pages, /bot
src/app/(auth)          login, signup, forgot/reset password
src/app/dashboard       websites, website report, checkout return, billing, settings
src/app/api             auth, websites, drafts, exports, billing portal, Dodo webhook
src/lib/aeo             crawler, page analysis, scoring, AI drafts, site fixes, audit runner
src/lib/billing.ts      Dodo subscription → website sync (idempotent)
src/lib/net             SSRF-safe HTTP client
src/lib/server          sessions, passwords, API helpers, checkout
src/db                  Drizzle schema and client
worker/index.ts         job queue, scheduler, stale-job recovery, cleanup
```
