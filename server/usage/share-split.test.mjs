// Tests the split of limit increases across sessions.
// Run with: node --test server/usage/share-split.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { advanceShares, emptyShareState, sharesBySession } from "./share-split.mjs";

/**
 * Builds a usage.json shape for the tests.
 *
 * Purpose: Keep test setup to one short call.
 *
 * @param percent Used percentage of the 5h window.
 * @param resetsAt Reset time of the window.
 * @returns Plan object with only the 5h window.
 */
const plan = (percent, resetsAt = 100) => ({ five_hour: { used_percentage: percent, resets_at: resetsAt } });



test("splits an increase by spend since the last snapshot", () => {
  // The first snapshot only sets baselines.
  let state = advanceShares(emptyShareState(), plan(10), { a: 1, b: 1 });
  state = advanceShares(state, plan(14), { a: 4, b: 2 });
  const shares = sharesBySession(state, ["a", "b"]);
  assert.equal(shares.a.five_hour, 3);
  assert.equal(shares.b.five_hour, 1);
});



test("drops an increase when no session spent anything", () => {
  // Arrange, advance, then assert on the shares.
  let state = advanceShares(emptyShareState(), plan(10), { a: 1 });
  state = advanceShares(state, plan(12), { a: 1 });
  assert.equal(sharesBySession(state, ["a"]).a.five_hour, 0);
});



test("shares add up to the observed increase", () => {
  // Arrange, advance, then assert on the shares.
  let state = advanceShares(emptyShareState(), plan(1), { a: 0, b: 0 });
  state = advanceShares(state, plan(2), { a: 1, b: 3 });
  state = advanceShares(state, plan(5), { a: 2, b: 3 });
  const shares = sharesBySession(state, ["a", "b"]);
  assert.ok(Math.abs(shares.a.five_hour + shares.b.five_hour - 4) < 1e-9);
});



test("a window reset sets shares back to zero", () => {
  // Arrange, advance, then assert on the shares.
  let state = advanceShares(emptyShareState(), plan(10), { a: 0 });
  state = advanceShares(state, plan(12), { a: 1 });
  state = advanceShares(state, plan(1, 200), { a: 2 });
  assert.equal(sharesBySession(state, ["a"]).a.five_hour, 0);
});



test("missing or partial usage never throws and keeps old state", () => {
  // Arrange, advance, then assert on the shares.
  let state = advanceShares(emptyShareState(), plan(10), { a: 0 });
  state = advanceShares(state, plan(12), { a: 1 });
  for (const broken of [null, {}, { five_hour: {} }, { five_hour: { used_percentage: "x" } }]) {
    state = advanceShares(state, broken, { a: 2 });
  }
  assert.equal(sharesBySession(state, ["a"]).a.five_hour, 2);
  assert.deepEqual(sharesBySession(emptyShareState(), ["a"]), { a: {} });
});



test("a session that starts later is charged from zero", () => {
  // Arrange, advance, then assert on the shares.
  let state = advanceShares(emptyShareState(), plan(10), { a: 1 });
  state = advanceShares(state, plan(12), { a: 1, b: 1 });
  const shares = sharesBySession(state, ["a", "b"]);
  assert.equal(shares.a.five_hour, 0);
  assert.equal(shares.b.five_hour, 2);
});
