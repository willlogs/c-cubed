// Checks background jobs: double clicks, parallel starts, failures.
// Run with node --test; the work here is plain promises.

import assert from "node:assert/strict";
import test from "node:test";
import { listJobs, runJob } from "./jobs.mjs";



/**
 * Builds work that waits until the test releases it.
 *
 * Purpose: Hold a job in the running state.
 *
 * Inputs: None.
 *
 * @returns The work function and its release callback.
 */
function heldWork() {
  // The job runs until release() is called.
  let release;
  const done = new Promise((resolve) => { release = resolve; });
  return { work: () => done, release };
}



test("a busy row refuses a second action", async () => {
  // Double clicking Start must not start twice.
  const held = heldWork();
  runJob("row-a", "start", held.work);
  assert.throws(() => runJob("row-a", "stop", async () => {}), /still running start/);
  held.release();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(listJobs()["row-a"].state, "done");
});


test("exclusive jobs run one at a time across rows", async () => {
  // Two starts at once could both pass the capacity guard.
  const held = heldWork();
  runJob("row-b", "start", held.work, { exclusive: true });
  assert.throws(() => runJob("row-c", "start", async () => {}, { exclusive: true }), /one stack at a time/);
  assert.doesNotThrow(() => runJob("row-d", "stop", async () => {}));
  held.release();
});


test("failures keep the error and the latest step", async () => {
  // The row shows the CLI's last line as the error.
  runJob("row-e", "start", async (log) => {
    log("\x1b[32mFetching\x1b[0m\nInstalling…\n");
    throw new Error("3 stacks already run; limit is 3.");
  });
  await new Promise((resolve) => setImmediate(resolve));
  const job = listJobs()["row-e"];
  assert.deepEqual([job.state, job.step, job.error], ["failed", "Installing…", "3 stacks already run; limit is 3."]);
  assert.deepEqual(job.lines, ["Fetching", "Installing…"]);
});
