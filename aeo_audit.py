#!/usr/bin/env python3
"""AEO auditor: crawl a site, run deterministic checks, store results, write report.html.
Usage: python aeo_audit.py example.com --max-pages 100 [--render]
"""
import argparse, json, re, sqlite3, time, html
from collections import deque
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse, urldefrag
from urllib.robotparser import RobotFileParser
import requests
from bs4 import BeautifulSoup

UA = "AEOAuditBot/0.1"
AI_BOTS = ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "Claude-User",
           "PerplexityBot", "Google-Extended", "CCBot", "Applebot-Extended"]

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs(id INTEGER PRIMARY KEY, domain TEXT, started TEXT);
CREATE TABLE IF NOT EXISTS pages(run_id INT, url TEXT, status INT, title TEXT, description TEXT,
  h1_count INT, words INT, rendered_words INT, schema_types TEXT, text_excerpt TEXT);
CREATE TABLE IF NOT EXISTS issues(run_id INT, url TEXT, code TEXT, severity TEXT, detail TEXT);
CREATE TABLE IF NOT EXISTS drafts(id INTEGER PRIMARY KEY, run_id INT, url TEXT, field TEXT,
  proposed TEXT, rationale TEXT, status TEXT DEFAULT 'draft', created TEXT);
"""

def now(): return datetime.now(timezone.utc).isoformat(timespec="seconds")

def check_access(base, domain):
    """robots.txt + AI user agents + sitemap. Returns (issues, sitemap_urls)."""
    issues, sitemaps = [], []
    rp = RobotFileParser(); rp.set_url(urljoin(base, "/robots.txt"))
    try:
        rp.read()
        for bot in AI_BOTS:
            if not rp.can_fetch(bot, base + "/"):
                issues.append(("/robots.txt", "AI_BOT_BLOCKED", "high", f"{bot} is disallowed"))
        sitemaps = rp.site_maps() or []
    except Exception as e:
        issues.append(("/robots.txt", "ROBOTS_UNREADABLE", "medium", str(e)))
    if not sitemaps:
        sitemaps = [urljoin(base, "/sitemap.xml")]
    urls = []
    for sm in sitemaps[:3]:
        try:
            r = requests.get(sm, headers={"User-Agent": UA}, timeout=15)
            if r.ok:
                urls += re.findall(r"<loc>\s*(.*?)\s*</loc>", r.text)
            else:
                issues.append((sm, "SITEMAP_MISSING", "medium", f"HTTP {r.status_code}"))
        except Exception as e:
            issues.append((sm, "SITEMAP_MISSING", "medium", str(e)))
    return issues, [u for u in urls if not u.endswith(".xml")]

def parse_jsonld(soup):
    types, problems = [], []
    for tag in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(tag.string or "")
        except Exception:
            problems.append("Invalid JSON-LD (parse error)"); continue
        items = data if isinstance(data, list) else data.get("@graph", [data])
        for it in items:
            if isinstance(it, dict):
                t = it.get("@type"); t = t if isinstance(t, list) else [t]
                types += [x for x in t if x]
                if "@context" not in data and "@context" not in it:
                    problems.append("JSON-LD missing @context")
    return types, problems

def analyse(url, resp, soup, rendered_words=None):
    """Return (page_record, issues) for one fetched page."""
    I = []
    def add(code, sev, detail=""): I.append((url, code, sev, detail))
    title = (soup.title.string or "").strip() if soup.title and soup.title.string else ""
    md = soup.find("meta", attrs={"name": "description"})
    desc = (md.get("content") or "").strip() if md else ""
    if not title: add("TITLE_MISSING", "high")
    elif not 15 <= len(title) <= 65: add("TITLE_LENGTH", "low", f"{len(title)} chars")
    if not desc: add("DESCRIPTION_MISSING", "high")
    elif not 70 <= len(desc) <= 165: add("DESCRIPTION_LENGTH", "low", f"{len(desc)} chars")
    robots = soup.find("meta", attrs={"name": "robots"})
    if robots and "noindex" in (robots.get("content") or "").lower(): add("NOINDEX", "high")
    if not soup.find("link", rel="canonical"): add("CANONICAL_MISSING", "medium")
    h1s = soup.find_all("h1")
    if len(h1s) != 1: add("H1_COUNT", "medium", f"{len(h1s)} h1 tags")
    levels = [int(h.name[1]) for h in soup.find_all(re.compile(r"^h[1-6]$"))]
    if any(b - a > 1 for a, b in zip(levels, levels[1:])): add("HEADING_SKIP", "low", "heading levels skip")
    noalt = [i for i in soup.find_all("img") if not (i.get("alt") or "").strip()]
    if noalt: add("IMG_ALT_MISSING", "low", f"{len(noalt)} images")
    types, problems = parse_jsonld(soup)
    for p in problems: add("SCHEMA_INVALID", "high", p)
    if not types: add("SCHEMA_MISSING", "medium")
    body = soup.find("main") or soup.body or soup
    for t in body(["script", "style", "nav", "footer"]): t.decompose()
    text = " ".join(body.get_text(" ").split()); words = len(text.split())
    if words < 150: add("THIN_CONTENT", "medium", f"{words} words")
    # answer-first: first paragraph after H1 should be a concise direct answer
    if h1s:
        p = h1s[0].find_next("p")
        if p and len(p.get_text().split()) > 80: add("NO_ANSWER_FIRST", "low", "first paragraph > 80 words")
    if not (soup.find(attrs={"itemprop": re.compile("author|datePublished|dateModified")})
            or soup.find("time") or soup.find("meta", attrs={"name": "author"})):
        add("TRUST_SIGNALS_MISSING", "low", "no author/date markup found")
    if rendered_words is not None and rendered_words > words * 1.5 + 50:
        add("JS_DEPENDENT_CONTENT", "high", f"raw {words} words vs rendered {rendered_words}")
    rec = dict(url=url, status=resp.status_code, title=title, description=desc, h1_count=len(h1s),
               words=words, rendered_words=rendered_words, schema_types=",".join(sorted(set(types))),
               text_excerpt=text[:3000])
    return rec, I

def render_words(url):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page(); pg.goto(url, wait_until="networkidle")
        n = len(pg.inner_text("body").split()); b.close(); return n

def crawl(domain, max_pages, render, db, delay=0.5):
    base = f"https://{domain}"
    con = sqlite3.connect(db); con.executescript(SCHEMA)
    run_id = con.execute("INSERT INTO runs(domain, started) VALUES(?,?)", (domain, now())).lastrowid
    access_issues, sm_urls = check_access(base, domain)
    for u, c, s, d in access_issues:
        con.execute("INSERT INTO issues VALUES(?,?,?,?,?)", (run_id, u, c, s, d))
    queue = deque([base + "/"] + sm_urls); seen = set(); n = 0
    host = urlparse(base).netloc
    while queue and n < max_pages:
        url = urldefrag(queue.popleft())[0]
        if url in seen or urlparse(url).netloc != host: continue
        seen.add(url)
        try:
            r = requests.get(url, headers={"User-Agent": UA}, timeout=20)
        except Exception as e:
            con.execute("INSERT INTO issues VALUES(?,?,?,?,?)", (run_id, url, "FETCH_FAILED", "high", str(e))); continue
        n += 1
        if r.status_code >= 400:
            con.execute("INSERT INTO issues VALUES(?,?,?,?,?)", (run_id, url, "HTTP_ERROR", "high", f"status {r.status_code}"))
            con.execute("INSERT INTO pages(run_id,url,status) VALUES(?,?,?)", (run_id, url, r.status_code)); continue
        if "text/html" not in r.headers.get("content-type", ""): continue
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.find_all("a", href=True):
            link = urljoin(url, a["href"])
            if link.startswith("http") and link not in seen: queue.append(link)
        rw = render_words(url) if render else None
        rec, issues = analyse(url, r, BeautifulSoup(r.text, "html.parser"), rw)
        con.execute("INSERT INTO pages VALUES(:run_id,:url,:status,:title,:description,:h1_count,:words,:rendered_words,:schema_types,:text_excerpt)",
                    {**rec, "run_id": run_id})
        con.executemany("INSERT INTO issues VALUES(?,?,?,?,?)", [(run_id, *i) for i in issues])
        con.commit(); time.sleep(delay)
    con.commit(); return con, run_id, n

def report(con, run_id, domain, out="report.html"):
    rows = con.execute("""SELECT url, code, severity, detail FROM issues WHERE run_id=?
        ORDER BY CASE severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, code""", (run_id,)).fetchall()
    tr = "".join(f"<tr class='{s}'><td>{s}</td><td>{html.escape(c)}</td><td>{html.escape(u)}</td><td>{html.escape(d or '')}</td></tr>"
                 for u, c, s, d in rows)
    open(out, "w").write(f"""<!doctype html><meta charset=utf-8><title>AEO audit: {domain}</title>
<style>body{{font:14px system-ui;margin:2rem}}table{{border-collapse:collapse;width:100%}}td,th{{border-bottom:1px solid #ddd;padding:6px;text-align:left}}
.high td:first-child{{color:#b00020;font-weight:600}}.medium td:first-child{{color:#b26a00}}</style>
<h1>AEO audit: {domain}</h1><p>{len(rows)} issues</p>
<table><tr><th>Severity</th><th>Issue</th><th>URL</th><th>Detail</th></tr>{tr}</table>""")

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("domain"); ap.add_argument("--max-pages", type=int, default=100)
    ap.add_argument("--render", action="store_true", help="compare raw vs JS-rendered content (needs playwright)")
    ap.add_argument("--db", default="aeo.db")
    a = ap.parse_args(); d = a.domain.replace("https://", "").replace("http://", "").strip("/")
    con, run_id, n = crawl(d, a.max_pages, a.render, a.db)
    report(con, run_id, d); print(f"Crawled {n} pages. Run {run_id}. Open report.html")
