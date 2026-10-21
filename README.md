# AEO audit starter

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
