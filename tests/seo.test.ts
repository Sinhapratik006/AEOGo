import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzePage } from "@/lib/aeo/analyze";
import { SEO_ONLY_CODES } from "@/lib/aeo/issues";
import { seoScore } from "@/lib/aeo/seo";

const GOOD_HEAD = `
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Running shoes for beginners | Example</title>
  <meta name="description" content="How to choose your first pair of running shoes: fit, cushioning, budget and the mistakes to avoid when buying online.">
  <link rel="canonical" href="https://example.com/guides/running-shoes">
  <meta property="og:title" content="Running shoes for beginners">
  <meta property="og:description" content="How to choose your first pair.">
  <meta property="og:image" content="https://example.com/og.png">
  <meta name="twitter:card" content="summary_large_image">`;

function codes(html: string, url = "https://example.com/guides/running-shoes"): string[] {
  return analyzePage({ url, status: 200, html }).issues.map((i) => i.code);
}

test("a well-built page has no SEO-only issues", () => {
  const html = `<!doctype html><html lang="en"><head>${GOOD_HEAD}</head><body>
    <h1>Running shoes</h1><img src="/a.jpg" width="10" height="10" alt="shoe">
    <a href="/guides">More guides</a></body></html>`;
  assert.deepEqual(
    codes(html).filter((c) => SEO_ONLY_CODES.has(c)),
    [],
  );
});

test("flags missing viewport, lang, social tags, links and image sizes", () => {
  const found = codes(`<html><head><title>Hi there, a fine title</title></head><body><img src="/a.jpg" alt="x"></body></html>`);
  for (const code of ["SEO_VIEWPORT_MISSING", "SEO_LANG_MISSING", "SEO_OPEN_GRAPH_MISSING", "SEO_NO_INTERNAL_LINKS", "SEO_IMG_DIMENSIONS_MISSING"]) {
    assert.ok(found.includes(code), `expected ${code}`);
  }
});

test("flags mixed content, off-site canonical and unfriendly URLs", () => {
  const html = `<html lang="en"><head>${GOOD_HEAD.replace("https://example.com/guides/running-shoes", "https://other.com/x")}</head>
    <body><script src="http://cdn.example.com/a.js"></script><a href="/">Home</a></body></html>`;
  const found = codes(html, "https://example.com/Guides/Running_Shoes");
  assert.ok(found.includes("SEO_MIXED_CONTENT"));
  assert.ok(found.includes("SEO_CANONICAL_OFFSITE"));
  assert.ok(found.includes("SEO_URL_UNFRIENDLY"));
});

test("SEO score: clean pages score 100, issues lower it, AEO-only codes are ignored", () => {
  const urls = ["https://example.com/", "https://example.com/a"];
  assert.equal(seoScore(urls, []), 100);
  assert.equal(seoScore(urls, [{ url: urls[0], code: "NO_ANSWER_FIRST", severity: "low" }]), 100);
  const withIssues = seoScore(urls, [
    { url: urls[0], code: "SEO_VIEWPORT_MISSING", severity: "high" },
    { url: "https://example.com/", code: "SEO_NOT_HTTPS", severity: "high" },
  ]);
  assert.ok(withIssues < 100);
  // Page: (80 + 100) / 2 = 90 * 0.75 = 67.5; site: 75 * 0.25 = 18.75 → 86
  assert.equal(withIssues, 86);
});
