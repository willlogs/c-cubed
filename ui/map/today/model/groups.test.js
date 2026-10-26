// Tests sorting Today items into groups, with status and reasons.
// Run: node --test ui/map/today/model/groups.test.js

import assert from "node:assert/strict";
import test from "node:test";
import { buildToday } from "./groups.js";

/** The daily plan every test map links to. */
const PLAN = { number: 90, title: "Daily plan", url: "https://github.com/o/r/issues/90" };

/**
 * Builds an issue node shaped like the server's.
 *
 * Purpose: Keep each fixture to one short call.
 *
 * @param number Issue number.
 * @param extra Fields that differ from an open work issue.
 * @returns Issue node.
 */
const node = (number, extra = {}) => ({
  number, title: `Issue ${number}`, state: "OPEN", url: `https://github.com/o/r/issues/${number}`, labels: [], kind: "work",
  parent: null, decisions: [], mentions: [], decidedBy: "", prs: [], children: [], ...extra,
});



/**
 * Builds a parsed plan line.
 *
 * Purpose: Name only what a test cares about.
 *
 * @param kind Section kind, such as bundle.
 * @param checked Whether the box is ticked.
 * @param issues Issue numbers on the line.
 * @param extra Note, PRs, or decisions.
 * @returns Plan line as the server sends it.
 */
const line = (kind, checked, issues = [], extra = {}) => ({ section: kind, kind, checked, issues, prs: [], decisions: [], note: "", ...extra });



/**
 * Builds a server map around Today data.
 *
 * Purpose: Default the plan and every empty list.
 *
 * @param issues Issue nodes.
 * @param today Today fields to override.
 * @param decisions Register decisions.
 * @returns Map payload.
 */
const mapOf = (issues, today = {}, decisions = []) => ({ decisions, issues, today: { plan: PLAN, items: [], questions: [], blocked: [], prs: [], ...today } });



/**
 * Lists one group's labels and status words.
 *
 * Purpose: Compare whole groups in one assertion.
 *
 * @param result Output of buildToday.
 * @param name Group name.
 * @returns Pairs of label and word.
 */
const group = (result, name) => result.groups.find((entry) => entry.name === name).items.map((item) => [item.label, item.word]);



/** A review pull request closing issue 49. */
const REVIEW = { number: 98, title: "PR 98", url: "https://github.com/o/r/pull/98", state: "OPEN", isDraft: false, review: true, closes: [49] };



test("Needs you gathers every kind of ask", () => {
  // Plan lines first, then questions, blocks, and reviews.
  const issues = [node(34, { kind: "question" }), node(9, { labels: ["needs-decision"] }), node(50, { labels: ["blocked"] }), node(23), node(51), node(49)];
  const items = [line("decision", false, [34]), line("task", false, [], { note: "Try Today" }), line("bundle", false, [23]), line("test", false, [51])];
  const decisions = [{ id: "D22", text: "No tool", consequence: "", issues: [34] }];
  const result = buildToday(mapOf(issues, { items, questions: [34, 9], blocked: [50], prs: [REVIEW] }, decisions), []);
  assert.deepEqual(group(result, "needs"), [
    ["#34", "recorded as D22"], ["", "your task"], ["#23", "waiting for approval"], ["#51", "to test"],
    ["#9", "your decision"], ["#50", "blocked"], ["#49", "waits for your review"],
  ]);
  assert.equal(result.groups[0].items.at(-1).openPr.number, 98);
});



test("moving work is in progress, approved is up next, closed is done", () => {
  // A live worker or an open PR counts as moving.
  const issues = [node(21, { prs: [{ number: 99, state: "OPEN", url: "u" }] }), node(16), node(4), node(37, { state: "CLOSED" }), node(60), node(61)];
  const items = [line("bundle", true, [21]), line("bundle", true, [16]), line("bundle", true, [4]), line("bundle", true, [37]), line("bundle", true, [], { prs: [44] })];
  const merged = { number: 44, title: "Record decisions", url: "u", state: "MERGED", isDraft: false, review: false, closes: [] };
  const sessions = [{ alive: true, meta: { issue: 16 } }, { alive: true, meta: { issue: 60 } }];
  const result = buildToday(mapOf(issues, { items, prs: [merged] }), sessions);
  assert.deepEqual(group(result, "progress"), [["#21", "in review"], ["#16", "in progress"], ["#60", "in progress"]]);
  assert.deepEqual(group(result, "next"), [["#4", ""]]);
  assert.deepEqual(group(result, "done"), [["#37", ""], ["PR #44", ""]]);
});



test("without a plan, only what needs the owner shows", () => {
  // A live worker alone is not an ask.
  const issues = [node(34, { kind: "question" }), node(50, { labels: ["blocked"] }), node(49), node(16)];
  const today = { plan: null, questions: [34], blocked: [50], prs: [REVIEW] };
  const result = buildToday(mapOf(issues, today), [{ alive: true, meta: { issue: 16 } }]);
  assert.deepEqual(result.groups.map((entry) => entry.name), ["needs"]);
  assert.deepEqual(group(result, "needs").map(([label]) => label), ["#34", "#50", "#49"]);
});



test("why lists decisions, parent, mentions, note, and quote", () => {
  // Issue 23 is part of goal 9 and names D21.
  const issues = [node(9), node(20), node(4), node(43, { kind: "plan" }), node(23, { parent: 9, mentions: [9, 20, 43], decidedBy: '"Use the CLIs"' })];
  const decisions = [{ id: "D06", text: "Staging", issues: [] }, { id: "D21", text: "CLIs", issues: [23] }];
  const items = [line("bundle", false, [23, 4], { note: "Staging, after #4 (D06)", decisions: ["D06"] })];
  const [item] = buildToday(mapOf(issues, { items }, decisions), []).groups[0].items;
  assert.deepEqual(item.why.decisions.map((decision) => decision.id), ["D21", "D06"]);
  assert.equal(item.why.parent.number, 9);
  assert.deepEqual(item.why.mentions.map((ref) => ref.number), [20, 4]);
  assert.deepEqual([item.why.note, item.why.quote, item.key], ["Staging, after #4 (D06)", '"Use the CLIs"', "i:9"]);
});



test("why lists open blockers apart from mentions", () => {
  // Issue 70 waits for 69 and also names it.
  const issues = [node(63), node(69), node(70, { parent: 63, blockedBy: [69], mentions: [69] })];
  const [item] = buildToday(mapOf(issues, { items: [line("bundle", false, [70])] }), []).groups[0].items;
  assert.deepEqual(item.why.blockedBy.map((ref) => ref.number), [69]);
  assert.deepEqual(item.why.mentions, []);
  assert.equal(item.why.parent.number, 63);
});



test("finished unticked lines hide, and old servers still render", () => {
  // An unticked line whose issue closed needs nobody.
  const hidden = buildToday(mapOf([node(37, { state: "CLOSED" })], { items: [line("bundle", false, [37])] }), []);
  assert.ok(hidden.groups.every((entry) => !entry.items.length));

  // A payload without today shows an empty "Needs you".
  assert.deepEqual(buildToday({ decisions: [], issues: [] }, []), { plan: null, groups: [{ name: "needs", items: [] }] });
});
