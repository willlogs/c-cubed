// Tests day counts, the activity run, heatmap shades, and columns.
// Run with: node --test server/data/progress/days.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { buildDays, runStart } from "./days.mjs";
import { columns, heatmap, totals } from "./grid.mjs";



/**
 * Builds a local timestamp on a day.
 *
 * Purpose: Keep fixtures in the owner's timezone.
 *
 * @param day Day key.
 * @returns ISO timestamp at local noon.
 */
function at(day) {
  // Noon never crosses a day boundary.
  return new Date(`${day}T12:00:00`).toISOString();
}



/** A lone old issue, then a three-day run. */
const DAYS = buildDays({
  issues: [
    { number: 1, labels: ["type:feature"], closedAt: at("2026-10-24"), dropped: false },
    { number: 2, labels: [], closedAt: at("2026-10-24"), dropped: true },
    { number: 3, labels: [], closedAt: at("2026-05-30"), dropped: false },
  ],
  prs: [
    { mergedAt: at("2026-10-23"), closes: [] }, { mergedAt: at("2026-10-25"), closes: [1] },
    { mergedAt: at("2026-10-25"), closes: [] },
  ],
  decisions: [{ id: "D9", importance: 5, at: Date.parse(at("2026-10-24")) }],
});



test("progress counts merged PRs by their issue's type", () => {
  // Dropped issues never count as closed.
  assert.equal(DAYS.get("2026-10-25").merged, 2);
  assert.equal(DAYS.get("2026-10-25").types.feature, 1);
  assert.equal(DAYS.get("2026-10-24").closed, 1);
  assert.equal(DAYS.get("2026-10-24").decisions[0].id, "D9");
});



test("the run starts after the last long gap", () => {
  // May's lone issue is too far back to count.
  assert.equal(runStart(DAYS, "2026-10-25"), "2026-10-23");
});



test("the heatmap pads to Monday and blanks days before the run", () => {
  // The 23rd is a Friday; the 19th opens its week.
  const cells = heatmap(DAYS, "2026-10-23", "2026-10-25").weeks.flat();
  assert.equal(cells[0].date, "2026-10-19");
  assert.ok(cells.filter((cell) => cell.before).every((cell) => cell.level === 0));
  assert.ok(cells.at(-1).level > cells.at(-2).level);
});



test("columns and totals cover only the run", () => {
  // Three columns; May stays out of the totals.
  assert.deepEqual(columns(DAYS, "2026-10-23", "2026-10-25").map((day) => day.merged), [1, 0, 2]);
  assert.deepEqual(totals(DAYS, "2026-10-23", "2026-10-25"), { merged: 3, closed: 1, decisions: 1, mergedToday: 2, decisionsToday: 0 });
});
