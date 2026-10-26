// Tests reading reasons out of issue markdown.
// Run with: node --test server/data/issue-text.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { decidedQuote } from "./issue-text.mjs";

/** A body shaped like #40: two quotes, more sections. */
const QUOTED = [
  "## Goal", "", "> Not this quote", "", "## Decided by", "", "the owner in the command center, 2026-10-23:", "",
  '> "Status should allow me', '> to test them easily."', "", "Later:", "", '> "A second quote"', "", "## Acceptance criteria", "> nor this",
].join("\n");



test("the first quote under Decided by is the owner's reason", () => {
  // Quotes elsewhere and later quotes are ignored.
  assert.equal(decidedQuote(QUOTED), '"Status should allow me to test them easily."');
});



test("bodies without a quoted Decided by give nothing", () => {
  // Decision-id lists are read elsewhere, as decisions.
  assert.equal(decidedQuote("### Decided by\n- D08: trunk\n\n### Goal\n> quote"), "");
  assert.equal(decidedQuote("## Goal\n> quote"), "");
  assert.equal(decidedQuote(null), "");
});
