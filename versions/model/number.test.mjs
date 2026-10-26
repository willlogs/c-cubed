// Tests version numbering: parse, compare, bump, and titles.
// Run with: node --test versions/model/number.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { bumpNumber, bumpOf, compareNumbers, formatTitle, nextNumber, parseTitle } from "./number.mjs";



test("the first version after the beta is 2.1.0", () => {
  // D95: minor per version, starting from 2.0.0-beta.0.
  assert.equal(nextNumber("2.0.0-beta.0", [], "minor"), "2.1.0");
  assert.equal(bumpNumber("2.1.0", "major"), "3.0.0");
  assert.equal(bumpNumber("2.1.0", "patch"), "2.1.1");
});



test("new versions number past every planned one", () => {
  // Two open versions: the third gets the next number.
  assert.equal(nextNumber("2.0.0-beta.0", ["2.1.0", "2.2.0"], "minor"), "2.3.0");
  assert.equal(nextNumber("2.1.0", ["2.2.0"], "patch"), "2.2.1");
});



test("prereleases sort before their release", () => {
  // Shipping 2.0.0 must count as past its beta.
  assert.ok(compareNumbers("2.0.0-beta.0", "2.0.0") < 0);
  assert.ok(compareNumbers("2.1.0", "2.0.0-beta.0") > 0);
  assert.equal(compareNumbers("v2.1.0", "2.1.0"), 0);
});



test("a planned number keeps its kind", () => {
  // Renumbering a lagging major keeps it a major.
  assert.equal(bumpOf("3.0.0"), "major");
  assert.equal(bumpOf("2.4.0"), "minor");
  assert.equal(bumpOf("2.4.1"), "patch");
});



test("titles round-trip, and other milestones are ignored", () => {
  // Any common dash or a colon separates the goal.
  assert.deepEqual(parseTitle(formatTitle("2.1.0", "In-app sign-in")), { number: "2.1.0", goal: "In-app sign-in" });
  assert.deepEqual(parseTitle("v2.2.0: Connectors"), { number: "2.2.0", goal: "Connectors" });
  assert.equal(parseTitle("Q4 cleanup"), null);
});
