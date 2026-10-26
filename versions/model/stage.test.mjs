// Tests grouping, stages, tracks, and next steps of a version.
// Run with: node --test versions/model/stage.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { describeVersion } from "../list.mjs";



/**
 * Builds a raw issue with the given labels.
 *
 * Purpose: Keep each test's setup to one line.
 *
 * @param number Issue number.
 * @param state OPEN or CLOSED.
 * @param labels Label names.
 * @returns Issue shaped like toVersions output.
 */
function issue(number, state, ...labels) {
  // No PRs; stage tests never need them.
  return { number, title: `Issue ${number}`, url: "", state, labels, prs: [] };
}



/**
 * Builds a raw open version holding the given issues.
 *
 * Purpose: Vary only what a test is about.
 *
 * @param issues Raw issues in the version.
 * @param extra Fields to override, such as release.
 * @returns Version shaped like toVersions output.
 */
function version(issues, extra = {}) {
  // Open, numbered 2.1.0, no release PRs yet.
  return { number: "2.1.0", goal: "Goal", open: true, issues, release: null, promotion: null, ...extra };
}



test("issues sort into groups, urgent first", () => {
  // Decisions, research, and everything else as work.
  const { groups } = describeVersion(version([
    issue(3, "OPEN", "type:chore", "P2"), issue(1, "OPEN", "decision"), issue(2, "OPEN", "type:research"),
    issue(4, "OPEN", "type:feature", "P0"), issue(5, "OPEN"),
  ]));
  assert.deepEqual(groups.decisions.map((item) => item.number), [1]);
  assert.deepEqual(groups.research.map((item) => item.number), [2]);
  assert.deepEqual(groups.work.map((item) => item.number), [4, 3, 5]);
});



test("the stage is the earliest unfinished step", () => {
  // Open decisions outrank open work.
  assert.equal(describeVersion(version([])).stage, "planning");
  assert.equal(describeVersion(version([issue(1, "OPEN", "decision"), issue(2, "OPEN", "type:feature")])).stage, "deciding");
  assert.equal(describeVersion(version([issue(1, "CLOSED", "decision"), issue(2, "OPEN", "type:feature")])).stage, "building");
  assert.equal(describeVersion(version([issue(2, "CLOSED", "type:feature")])).stage, "ready");
});



test("release steps take over once started", () => {
  // Release PR, promotion PR, publish, live.
  const done = [issue(2, "CLOSED", "type:feature")];
  const merged = { number: 9, state: "MERGED", url: "", mergeCommit: "abc" };
  assert.equal(describeVersion(version(done, { release: { ...merged, state: "OPEN" } })).stage, "releasing");
  assert.equal(describeVersion(version(done, { release: merged, promotion: { ...merged, number: 10, state: "OPEN" } })).stage, "promoting");
  assert.equal(describeVersion(version(done, { release: merged, promotion: { ...merged, number: 10 } })).stage, "publishing");
  assert.equal(describeVersion(version(done, { open: false })).stage, "live");
});



test("the track skips empty steps and counts the rest", () => {
  // No decisions or research: those steps are skipped.
  const described = describeVersion(version([issue(2, "CLOSED", "type:feature"), issue(3, "OPEN", "type:bug")]));
  assert.deepEqual(described.track.map((step) => step.state), ["skip", "skip", "active", "todo", "todo"]);
  assert.deepEqual({ done: described.track[2].done, total: described.track[2].total }, { done: 1, total: 2 });
  assert.equal(described.next, "1 work issue(s) still open.");
});



test("a ready version says to run ship", () => {
  // The command names the version.
  const described = describeVersion(version([issue(2, "CLOSED", "type:feature")]));
  assert.match(described.next, /npm run cc -- version ship v2\.1\.0/);
  assert.equal(described.track[3].state, "active");
});
