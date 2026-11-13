# AEOGo

## Web app (Next.js + Node.js)

The full product lives in [`web/`](web/README.md): marketing site, accounts, Dodo Payments
subscriptions, a customer dashboard, and a worker that audits each paying customer's website
for AI answer engines and writes the fixes. See [`web/README.md`](web/README.md) for setup.

    cd web
    npm install
    cp .env.example .env.local
    npm run db:migrate
    npm run dev

## AEO audit starter (Python prototype)

The original command-line auditor. The web app's TypeScript engine (`web/src/lib/aeo`) is a
port and extension of these checks.

    pip install -r requirements.txt
    python aeo_audit.py yourdomain.com --max-pages 100      # add --render for JS comparison
    open report.html
    ANTHROPIC_API_KEY=sk-... python draft_fixes.py          # drafts only, status='draft'

**Checks:** robots.txt and AI-bot access, sitemap, status codes, title/description, canonical, noindex,
H1/heading structure, JSON-LD validity and types, thin content, answer-first paragraph, author/date signals,
raw vs rendered content (JS dependence).

**Stored in aeo.db (SQLite):** runs, pages, issues, drafts. Schema is plain SQL, so moving to Postgres means
swapping the connection and `INTEGER PRIMARY KEY` for `SERIAL`.

**Next steps:** dashboard over `issues`/`drafts`, Search Console import, fixed-query citation tracker,
and publishing (last, with page versioning and approval).
