import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzePage } from "@/lib/aeo/analyze";
import {
  AEO_CATEGORIES,
  GEO_CATEGORIES,
  GEO_ONLY_CODES,
  INFORMATIONAL_CODES,
  ISSUE_INFO,
  issueCategory,
  passedLabel,
  SEO_CATEGORIES,
} from "@/lib/aeo/issues";
import { aeoScore, geoScore, seoScore } from "@/lib/aeo/seo";

const URL = "https://example.com/guides/running-shoes";
const filler = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

function geoCodes(body: string, head = ""): string[] {
  const html = `<html lang="en"><head>${head}</head><body><main>${body}</main></body></html>`;
  return analyzePage({ url: URL, status: 200, html })
    .issues.map((i) => i.code)
    .filter((c) => GEO_ONLY_CODES.has(c));
}

test("a citable, well-structured page has no GEO-only issues", () => {
  const body = `<h1>Running shoes</h1>
    <h2>How much should I spend?</h2><p>Most beginners spend $90 to $130. ${filler(120)}</p>
    <ul><li>Measure in the evening</li><li>Leave a thumb's width</li></ul>
    <p>According to <a href="https://www.who.int/">the WHO</a>, 150 minutes a week helps. ${filler(120)}</p>
    <p>${filler(80)}</p>`;
  assert.deepEqual(geoCodes(body), []);
});

test("flags missing statistics, sources, question headings, lists and long paragraphs", () => {
  const body = `<h1>Running shoes</h1><h2>Choosing a shoe</h2><p>${filler(200)}</p><p>${filler(160)}</p>
    <a href="/guides">More guides</a>`;
  const found = geoCodes(body);
  for (const code of ["GEO_NO_STATISTICS", "GEO_NO_SOURCES", "GEO_NO_QUESTION_HEADINGS", "GEO_NO_LISTS_OR_TABLES", "GEO_LONG_PARAGRAPHS"]) {
    assert.ok(found.includes(code), `expected ${code}`);
  }
});

test("short pages aren't held to GEO content checks", () => {
  assert.deepEqual(geoCodes(`<h1>Contact</h1><p>${filler(100)}</p>`), []);
});

test("FAQPage markup counts as question-style content", () => {
  const head = `<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage"}</script>`;
  const found = geoCodes(`<h1>FAQ</h1><h2>Shipping</h2><p>${filler(320)}</p>`, head);
  assert.ok(!found.includes("GEO_NO_QUESTION_HEADINGS"));
});

test("detects brand entity markup and sameAs on a page", () => {
  const entity = (json: string) =>
    analyzePage({ url: URL, status: 200, html: `<html><head><script type="application/ld+json">${json}</script></head><body></body></html>` })
      .record.entity;
  assert.equal(entity(`{"@context":"https://schema.org","@type":"WebSite"}`), "none");
  assert.equal(entity(`{"@context":"https://schema.org","@type":"Organization","name":"Ex"}`), "no-sameas");
  assert.equal(
    entity(`{"@context":"https://schema.org","@graph":[{"@type":"Organization","sameAs":["https://x.com/ex"]}]}`),
    "ok",
  );
});

test("each score only counts its own checks", () => {
  const urls = ["https://example.com/"];
  const row = (code: string) => [{ url: urls[0], code, severity: "high" as const }];
  assert.equal(geoScore(urls, []), 100);
  assert.ok(geoScore(urls, row("GEO_NO_STATISTICS")) < 100);
  assert.equal(geoScore(urls, row("AI_BOT_BLOCKED")), 100);
  assert.ok(aeoScore(urls, row("AI_BOT_BLOCKED")) < 100);
  assert.equal(aeoScore(urls, row("TITLE_MISSING")), 100);
  assert.ok(seoScore(urls, row("TITLE_MISSING")) < 100);
  assert.equal(issueCategory("GEO_NO_SOURCES"), "GEO");
  assert.equal(issueCategory("SCHEMA_MISSING"), "AEO");
  assert.equal(issueCategory("TITLE_MISSING"), "SEO");
  assert.equal(issueCategory("CRAWL_TIME_LIMIT"), "Info");
});

test("every scored check belongs to exactly one of AEO, SEO and GEO, with a pass label", () => {
  const scored = Object.keys(ISSUE_INFO).filter((c) => !INFORMATIONAL_CODES.has(c)).sort();
  const grouped = [AEO_CATEGORIES, SEO_CATEGORIES, GEO_CATEGORIES].flat().flatMap((c) => c.codes);
  assert.deepEqual([...grouped].sort(), scored);
  assert.equal(new Set(grouped).size, grouped.length, "a check is listed in more than one report");
  for (const code of grouped) {
    assert.notEqual(passedLabel(code), ISSUE_INFO[code].title, `missing pass label for ${code}`);
  }
});
