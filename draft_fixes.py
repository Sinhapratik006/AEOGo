#!/usr/bin/env python3
"""Generate title/description drafts for pages that need them. Drafts are saved as status='draft'
and are NEVER published. Review them in the DB (or build the dashboard on top of the `drafts` table).
Usage: ANTHROPIC_API_KEY=... python draft_fixes.py [--db aeo.db] [--limit 20]
"""
import argparse, json, sqlite3
from datetime import datetime, timezone
import anthropic

SYSTEM = """You write SEO/AEO metadata. Use ONLY facts present in the page text provided.
Do not invent statistics, prices, awards, or claims. If the page lacks enough information, say so.
Return ONLY JSON: {"title": str (<=60 chars), "description": str (110-160 chars),
"unsupported_claims": [str], "rationale": str}"""

ap = argparse.ArgumentParser(); ap.add_argument("--db", default="aeo.db"); ap.add_argument("--limit", type=int, default=20)
a = ap.parse_args()
con = sqlite3.connect(a.db); client = anthropic.Anthropic()
run_id = con.execute("SELECT MAX(id) FROM runs").fetchone()[0]
rows = con.execute("""SELECT DISTINCT p.url, p.title, p.description, p.text_excerpt FROM pages p
    JOIN issues i ON i.run_id=p.run_id AND i.url=p.url
    WHERE p.run_id=? AND i.code IN ('TITLE_MISSING','DESCRIPTION_MISSING','TITLE_LENGTH','DESCRIPTION_LENGTH')
    LIMIT ?""", (run_id, a.limit)).fetchall()
for url, title, desc, text in rows:
    msg = client.messages.create(model="claude-sonnet-5-5", max_tokens=600, system=SYSTEM,
        messages=[{"role": "user", "content": f"URL: {url}\nCurrent title: {title}\nCurrent description: {desc}\nPage text:\n{text}"}])
    try:
        out = json.loads(msg.content[0].text.strip().strip("`").removeprefix("json").strip())
    except Exception:
        print("skip (bad JSON):", url); continue
    flag = " [REVIEW: unsupported claims: %s]" % out["unsupported_claims"] if out.get("unsupported_claims") else ""
    for field in ("title", "description"):
        con.execute("INSERT INTO drafts(run_id,url,field,proposed,rationale,created) VALUES(?,?,?,?,?,?)",
                    (run_id, url, field, out[field], out.get("rationale", "") + flag, datetime.now(timezone.utc).isoformat()))
    con.commit(); print("drafted:", url)
