// Tests reading daily plan checklists into Today items.
// Run with: node --test server/data/today/plan.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { parsePlan, toggleLine } from "./plan.mjs";

/** The real body of daily plan #43, from 2026-10-23. */
const PLAN_43 = `## Decisions needed
- [x] #34 duplicated-code tool: settled as D22 (no tool for now)

## Proposed bundle (tick to approve; untick to skip)
the owner asked for each of these directly in the command center today, so they count as approved.
- [x] #37 Session cards show 5h/7d share instead of dollars (Sonnet, S) → PR #41 merged
- [x] #40 Status: one-click stacks for master, open PRs, issue branches, every worktree (Opus, M) → PR #47 merged
- [x] #42 Sessions: auto mode, Open issue button, compact ended sessions with Clean (Sonnet, S) → PR #46 merged
- [x] #38 CI: verify PRs locally; GitHub CI only on staging and production (Opus, S) → PR #48 merged
- [x] #39 Map: newest first, one click unfolds everything grayed out (Sonnet, S) → PR #45 merged
- [x] Record today's decisions D23–D28 in the Decision Register → PR #44 merged

## Progress
- 21:21 #36 verify green (7m02s); the owner merges it himself (changes agent rules)
- 21:31 #37 PR #41 opened (Sonnet); reviewed, 6/6 tests pass, waiting on CI
- 21:33 #40 dispatched (Opus)

- 21:38 #36 merged by the owner; #41 updated with master, CI rerunning
- 21:38 #38 dispatched (Opus), #39 dispatched (Sonnet); #40 scope extended with merge-ref previews (the owner)
- 21:38 D23–D27 recorded → PR #44 merged

- 21:43 #41 merged (closes #37); restart the command center to see limit shares on cards

- 21:52 the owner: verify PRs locally, not on GitHub (D23 updated, #38 rescoped). Local full verify 40s vs 4–6 min on GitHub
- 21:52 #45 (Map), #44 (D23–D28), #46 (sessions) verified locally and merged

- 22:02 #38 → PR #48 reviewed; worker adding a 'local verify' commit status. the owner: the master merges #48 after local verify (no human review needed)
- 22:02 the owner: Status also lists every local worktree (into #47 if quick). the owner's own Claude builds: assistant session, idle message queue, kill guard, auto mode for all sessions, Home view, Today panel on the Map; no workers for these; D29+ reserved for it

- 22:06 #48 merged (closes #38) after its own npm run cc -- verify: PASS in 43.4s. PRs and master no longer run GitHub CI

- 22:08 #47 merged (closes #40): local verify PASS 42.6s. All of today's command-center tasks are on master

## Test checklist (filled after staging is cut)

## Health report (end of day)`;



test("plan #43 yields its seven checklist lines in order", () => {
  // Progress lines have no checkbox, so they never become items.
  const items = parsePlan(PLAN_43);
  assert.equal(items.length, 7);
  assert.deepEqual(items.map((item) => item.numbers[0]), [34, 37, 40, 42, 38, 39, 44]);
  assert.ok(items.every((item) => item.checked));
});



test("headings set the section name and kind", () => {
  // Template hints in parentheses are dropped from the name.
  const [decision, bundle] = parsePlan(PLAN_43);
  assert.deepEqual([decision.section, decision.kind], ["Decisions needed", "decision"]);
  assert.deepEqual([bundle.section, bundle.kind], ["Proposed bundle", "bundle"]);
});



test("the leading issue is split from the note", () => {
  // Arrange from #43, then check the bundle line for #37.
  const line = parsePlan(PLAN_43)[1];
  assert.deepEqual(line.numbers, [37, 41]);
  assert.equal(line.note, "Session cards show 5h/7d share instead of dollars (Sonnet, S) → PR #41 merged");
});



test("decision ids in a note are named", () => {
  // The decision line names D22; the record line, a range.
  const items = parsePlan(PLAN_43);
  assert.deepEqual(items[0].decisions, ["D22"]);
  assert.equal(items[0].note, "duplicated-code tool: settled as D22 (no tool for now)");
  assert.deepEqual(items[6].decisions, ["D23", "D28"]);
});



test("a line without a leading issue keeps all its text", () => {
  // The record line names only a pull request, last.
  const line = parsePlan(PLAN_43)[6];
  assert.deepEqual(line.numbers, [44]);
  assert.equal(line.note, "Record today's decisions D23–D28 in the Decision Register → PR #44 merged");
});



test("lines off the template still show their issue", () => {
  // Odd bullets, boxes, and placements from a careless edit.
  const body = [
    "## Your tasks", "* [ ] Merge #36 yourself", "1. [X] #12: test on staging",
    "## Test checklist (filled after staging is cut)", "+ [ ] Board picker (https://github.com/o/r/issues/14)", "- [ ] #15",
    "## Notes", "- [ ] nothing linked", "- #16 no checkbox, so skipped",
  ].join("\r\n");
  const items = parsePlan(body);
  assert.deepEqual(items.map((item) => [item.kind, item.checked, item.numbers]), [
    ["task", false, [36]], ["task", true, [12]], ["test", false, [14]], ["test", false, [15]], ["other", false, []],
  ]);
  assert.deepEqual(items.map((item) => item.note), ["Merge #36 yourself", "test on staging", "Board picker (https://github.com/o/r/issues/14)", "", "nothing linked"]);
});



test("a missing or empty body yields no items", () => {
  // The panel then shows only what needs the owner.
  assert.deepEqual(parsePlan(undefined), []);
  assert.deepEqual(parsePlan(""), []);
});



test("toggleLine ticks one line and leaves the rest alone", () => {
  // Line 2 is the second checkbox, #37's.
  const [, second] = parsePlan(PLAN_43);
  assert.deepEqual([second.index, second.text.slice(0, 3)], [1, "#37"]);
  const unticked = toggleLine(PLAN_43, 1, second.text, false);
  const lines = parsePlan(unticked);
  assert.equal(lines[1].checked, false);
  assert.ok(lines.every((line, index) => index === 1 || line.checked === parsePlan(PLAN_43)[index].checked));
  assert.equal(unticked.split("\n").length, PLAN_43.split("\n").length);

  // Ticking it again restores the original body.
  assert.equal(toggleLine(unticked, 1, second.text, true), PLAN_43);
});



test("toggleLine refuses a line that moved, and keeps CRLF", () => {
  // The Map's text must still match the line.
  assert.throws(() => toggleLine(PLAN_43, 1, "#38 something else", true), /plan changed/);
  assert.throws(() => toggleLine(PLAN_43, 99, "anything", true), /plan changed/);

  // Bodies saved on the web use CRLF; keep it.
  const crlf = "## Bundle\r\n- [ ] #5 Fix it\r\n- [ ] #6 Ship it\r\n";
  assert.equal(toggleLine(crlf, 1, "#6 Ship it", true), "## Bundle\r\n- [ ] #5 Fix it\r\n- [x] #6 Ship it\r\n");
});
