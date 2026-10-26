// Tests collecting Today's facts from GitHub issues and PRs.
// Run with: node --test server/data/today/build.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { buildToday } from "./build.mjs";

/**
 * Builds a gh issue or pull request for the tests.
 *
 * Purpose: Keep each fixture to one short line.
 *
 * @param number Issue or pull request number.
 * @param state OPEN, CLOSED, or MERGED.
 * @param labels Label names.
 * @param extra Any other fields, such as a body.
 * @returns Object shaped like gh's JSON output.
 */
const item = (number, state, labels = [], extra = {}) => ({
  number, state, title: `Title ${number}`, url: `https://github.com/o/r/issues/${number}`,
  labels: labels.map((name) => ({ name })), ...extra,
});

/** Plan naming an issue, a merged PR, an open PR. */
const PLAN = "## Proposed bundle\n- [x] #12 Board picker → PR #20 merged\n- [ ] Record decisions → PR #21";



test("the newest open daily plan wins", () => {
  // A closed newer plan and an older open plan exist.
  const issues = [item(5, "OPEN", ["daily-plan"], { body: "- [ ] #1 old" }), item(9, "OPEN", ["daily-plan"], { body: PLAN }), item(11, "CLOSED", ["daily-plan"])];
  const today = buildToday(issues, [item(20, "MERGED"), item(21, "OPEN")]);
  assert.equal(today.plan.number, 9);
  assert.equal(today.items.length, 2);
});



test("plan numbers split into issues and pull requests", () => {
  // Numbers gh lists as pull requests are PRs; others issues.
  const issues = [item(9, "OPEN", ["daily-plan"], { body: PLAN }), item(12, "OPEN")];
  const today = buildToday(issues, [item(20, "MERGED"), item(21, "OPEN")]);
  assert.deepEqual(today.items.map((line) => [line.issues, line.prs]), [[[12], [20]], [[], [21]]]);
  assert.deepEqual(today.prs.map((pr) => [pr.number, pr.state, pr.review]), [[20, "MERGED", false], [21, "OPEN", false]]);
});



test("open questions, blocked issues, and ready reviews are collected", () => {
  // Closed issues and draft or closed PRs wait on nobody.
  const issues = [
    item(3, "OPEN", ["decision"]), item(4, "CLOSED", ["decision"]), item(6, "OPEN", ["needs-decision"]),
    item(7, "OPEN", ["blocked"]), item(8, "CLOSED", ["blocked"]),
  ];
  const review = ["needs-human-review"];
  const prs = [
    item(30, "OPEN", review, { closingIssuesReferences: [{ number: 7 }] }), item(31, "OPEN", review, { isDraft: true }),
    item(32, "MERGED", review), item(33, "OPEN"),
  ];
  const today = buildToday(issues, prs);
  assert.deepEqual(today.questions, [6, 3]);
  assert.deepEqual(today.blocked, [7]);
  assert.deepEqual(today.prs.map((pr) => [pr.number, pr.review, pr.closes]), [[30, true, [7]]]);
});



test("without a plan, Today still lists what needs the owner", () => {
  // No daily-plan issue is open.
  const today = buildToday([item(3, "OPEN", ["decision"])], []);
  assert.equal(today.plan, null);
  assert.deepEqual(today.items, []);
  assert.deepEqual(today.questions, [3]);
});
