// Tests writing, finding, and prepending changelog sections.
// Run with: node --test versions/changelog/section.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { describeVersion } from "../list.mjs";
import { changelogSection, findSection, prependSection } from "./section.mjs";



/**
 * Builds a closed issue with labels, decisions, and one PR.
 *
 * Purpose: Keep the fixture version readable.
 *
 * @param number Issue number; its PR is number + 100.
 * @param labels Label names.
 * @param decisions Decision IDs its body names.
 * @returns Issue shaped like toVersions output.
 */
function issue(number, labels, decisions = []) {
  // One merged PR per issue.
  return { number, title: `Issue ${number}`, url: "", state: "CLOSED", labels, decisions, prs: [{ number: number + 100, state: "MERGED" }] };
}



/** A finished version with one of each kind of issue. */
const VERSION = describeVersion({
  number: "2.1.0", goal: "Saved searches", about: "Keep searches between visits.", url: "https://x/milestone/1", open: true,
  release: null, promotion: null,
  issues: [
    issue(84, ["decision"]), issue(68, ["type:research"], ["D42"]),
    issue(90, ["type:bug", "P1"], ["D46"]), issue(85, ["type:feature", "P0"], ["D42", "D44"]), issue(91, ["type:chore"]),
  ],
});



test("a section lists the goal, basis, and changes by priority", () => {
  // P0 before P1 before unlabeled; each with issue and PR.
  const section = changelogSection(VERSION, "2026-10-30", []);
  assert.match(section, /^## v2\.1\.0 — Saved searches\n\nReleased 2026-10-30 · \[Milestone\]\(https:\/\/x\/milestone\/1\)\n\n> Keep searches between visits\./);
  assert.match(section, /\*\*Decisions:\*\* D42, D44, D46 · answered #84 Issue 84/);
  assert.match(section, /\*\*Research:\*\* #68 Issue 68/);
  const order = ["### P0", "- Feature: Issue 85 (#85, PR #185)", "### P1", "- Bug: Issue 90 (#90, PR #190)", "### No priority", "- Chore: Issue 91"];
  const positions = order.map((text) => section.indexOf(text));
  assert.ok(positions.every((position, index) => position > (positions[index - 1] ?? -1)), section);
});



test("loose merges are listed as also shipped", () => {
  // They keep their priority prefix, urgent first.
  const loose = [{ number: null, title: "Tidy docs", type: null, priority: null, prs: [7] }, { number: 5, title: "Fix it", type: "bug", priority: "P0", prs: [6] }];
  const section = changelogSection(VERSION, "2026-10-30", loose);
  assert.match(section, /<summary>Also shipped \(2\)<\/summary>\n\n- P0 · Bug: Fix it \(#5, PR #6\)\n- Tidy docs \(PR #7\)/);
});



test("sections prepend under the intro and can be found again", () => {
  // Newest first; each runs to the next heading.
  const older = "## v2.1.0 — Old\n\nOld text.\n";
  const changelog = prependSection(prependSection("# Changelog\n\nIntro.\n", older), "## v2.2.0 — New\n\nNew text.\n");
  assert.equal(changelog, "# Changelog\n\nIntro.\n\n## v2.2.0 — New\n\nNew text.\n\n## v2.1.0 — Old\n\nOld text.\n");
  assert.equal(findSection(changelog, "2.1.0"), older);
  assert.equal(findSection(changelog, "2.2.0"), "## v2.2.0 — New\n\nNew text.\n");
  assert.equal(findSection(changelog, "9.9.9"), "");
});
