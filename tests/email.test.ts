import { test } from "node:test";
import assert from "node:assert/strict";
import { isValidEmail } from "@/lib/email";

/**
 * Unit tests for the client-safe email format validator used by the login form
 * to report invalid emails without clearing the form.
 */

test("accepts normal email addresses", () => {
  assert.equal(isValidEmail("user@example.com"), true);
  assert.equal(isValidEmail("first.last+tag@sub.domain.org"), true);
  assert.equal(isValidEmail("a@b.co"), true);
});

test("rejects malformed addresses and missing pieces", () => {
  assert.equal(isValidEmail(""), false);
  assert.equal(isValidEmail("user"), false);
  assert.equal(isValidEmail("user@"), false);
  assert.equal(isValidEmail("@example.com"), false);
  assert.equal(isValidEmail("user@example"), false); // no TLD
  assert.equal(isValidEmail("user name@example.com"), false); // spaces
  assert.equal(isValidEmail("user@exam ple.com"), false);
  assert.equal(isValidEmail("user@@example.com"), false);
});

test("enforces the 254 character limit", () => {
  assert.equal(isValidEmail(`${"a".repeat(249)}@b.co`), true); // exactly 254 chars
  assert.equal(isValidEmail(`${"a".repeat(250)}@b.co`), false); // 255 chars
});
