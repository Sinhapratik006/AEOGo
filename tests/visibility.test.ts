import { test } from "node:test";
import assert from "node:assert/strict";
import { bareDomain, visibilityScore, type QuestionResult } from "@/lib/aeo/visibility";

const q = (cited: boolean, error?: string): QuestionResult => ({
  question: "best running shoes",
  cited,
  inResults: cited,
  citedInstead: [],
  answer: "",
  error,
});

test("visibility score: 60% citations, 20% brand search, 20% brand knowledge", () => {
  assert.equal(visibilityScore({ aiKnowsBrand: false, brandSearchFindsSite: false, questions: [q(false), q(false)] }), 0);
  assert.equal(visibilityScore({ aiKnowsBrand: false, brandSearchFindsSite: true, questions: [q(true), q(false)] }), 50);
  assert.equal(visibilityScore({ aiKnowsBrand: true, brandSearchFindsSite: true, questions: [q(true)] }), 100);
});

test("questions that couldn't be checked don't count against the site", () => {
  assert.equal(visibilityScore({ aiKnowsBrand: false, brandSearchFindsSite: false, questions: [q(true), q(false, "timeout")] }), 60);
  assert.equal(visibilityScore({ aiKnowsBrand: false, brandSearchFindsSite: false, questions: [] }), 0);
});

test("bareDomain normalizes www and case", () => {
  assert.equal(bareDomain("https://WWW.Example.com/a?b"), "example.com");
  assert.equal(bareDomain("not a url"), "");
});
