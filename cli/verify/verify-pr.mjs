// Verifies one pull request locally; GitHub runs no PR checks.
// Prints each step, then pass or fail, with timings.

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig, readConfigFile } from "../../config/load.mjs";
import { mainCheckout } from "../../config/paths.mjs";
import { needsPrepare, recordPrepared } from "../../instances/worktree/create.mjs";
import { gateSteps } from "../project/check.mjs";
import { checkoutPullRequest } from "./checkout.mjs";
import { recordVerdict, setCommitStatus, short } from "./status.mjs";
import { logTail, runStep } from "./steps.mjs";




/**
 * Verifies a pull request merged with its current base.
 *
 * Purpose: Gate merges locally, faster than GitHub's runners.
 *
 * Side effects: Rewrites the verify worktree; writes logs and status.
 *
 * @param pr Pull request number as typed.
 * @returns Exit code: 0 when every check passed.
 */
export function verifyPullRequest(pr) {
  // Accept only a pull request number.
  if (!/^\d+$/.test(pr ?? "")) throw new Error("Usage: npm run cc -- verify <pr-number>");
  const started = Date.now();
  const logDir = path.join(os.tmpdir(), "cc-verify", `pr-${pr}`);
  fs.mkdirSync(logDir, { recursive: true });

  // Build the tree a squash merge would land.
  const target = checkoutPullRequest(pr);
  printStep("checkout", true, secondsSince(started), `head ${short(target.head)} + ${target.base} ${short(target.baseSha)}`);
  setCommitStatus(target.head, "pending", `Running, merged with ${target.base} ${short(target.baseSha)}`);

  // Never leave the GitHub status pending after a crash.
  try {
    return printVerdict(pr, target, started, runChecks(target, logDir));
  } catch (error) {
    setCommitStatus(target.head, "failure", `Crashed: ${error.message}`);
    throw error;
  }
}



/**
 * Runs setup when needed, then every gate step.
 *
 * Purpose: Verify exactly what cc check verifies.
 *
 * @param target Worktree, base name, and base commit.
 * @param logDir Folder for one log per step.
 * @returns Names of failed steps; empty means pass.
 */
function runChecks(target, logDir) {
  // The PR's own settings decide its setup and checks.
  const { worktree } = target;
  const config = readConfigFile(worktree) ? loadConfig(worktree, true) : { ...loadConfig(mainCheckout()), root: worktree };
  if (!prepareIfNeeded(worktree, config, logDir)) return ["setup"];

  // Run every step, even after one fails, to report all.
  return gateSteps(config, target.baseSha)
    .map((step) => printResult({ name: step.name, ...runStep({ ...step, cwd: worktree, logDir }) }))
    .filter((result) => !result.ok)
    .map((result) => result.name);
}



/**
 * Runs the project's worktree setup when lockfiles changed.
 *
 * Purpose: Skip slow installs between runs.
 *
 * @param worktree Verify worktree.
 * @param config Settings for that worktree.
 * @param logDir Folder for the setup log.
 * @returns Whether setup passed or was skipped.
 */
function prepareIfNeeded(worktree, config, logDir) {
  // Report the skip so timings stay comparable.
  if (!needsPrepare(worktree)) {
    printStep("setup", true, 0, "skipped, lockfiles unchanged");
    return true;
  }

  // Record the lockfiles only after every step passed.
  const ok = config.worktrees.setup.every((command, index) => printResult({ name: `setup ${index + 1}`, ...runStep({ name: `setup-${index + 1}`, command: "sh", args: ["-c", command], cwd: worktree, logDir }) }).ok);
  if (ok) recordPrepared(worktree);
  return ok;
}



/**
 * Prints one step's result, with its log tail on failure.
 *
 * Purpose: Show why a step failed without opening logs.
 *
 * @param result Step name, outcome, duration, and log file.
 * @returns The same result, for chaining.
 */
function printResult(result) {
  // One line per step, then the failing log's tail.
  printStep(result.name, result.ok, result.seconds, result.ok ? "" : `log: ${result.logFile}`);
  if (!result.ok) console.log(`${logTail(result.logFile)}\n`);
  return result;
}



/**
 * Prints one aligned step line.
 *
 * Purpose: Keep the report scannable at a glance.
 *
 * Side effects: Writes to standard output.
 *
 * @param name Step name.
 * @param ok Whether the step passed.
 * @param seconds Step duration.
 * @param note Extra detail, such as a log path.
 * @returns No value.
 */
function printStep(name, ok, seconds, note = "") {
  // Mark, name, duration, then any note.
  console.log(`  ${ok ? "✓" : "✗"} ${name.padEnd(12)} ${`${seconds.toFixed(1)}s`.padStart(7)}  ${note}`.trimEnd());
}



/**
 * Prints pass or fail and records it on GitHub.
 *
 * Purpose: End with one line the master can act on.
 *
 * Side effects: Writes output; records the verdict on GitHub.
 *
 * @param pr Pull request number.
 * @param target Verified head and base.
 * @param started Run start time in milliseconds.
 * @param failed Names of failed steps.
 * @returns Exit code: 0 on pass, 1 on fail.
 */
function printVerdict(pr, target, started, failed) {
  // Failures name every step to send back.
  const total = `${secondsSince(started).toFixed(1)}s`;
  recordVerdict(pr, target, total, failed);
  if (failed.length > 0) {
    console.log(`FAIL PR #${pr} in ${total}: ${failed.join(", ")}.`);
    return 1;
  }

  // Passing runs pin the merge to the verified head.
  console.log(`PASS PR #${pr} in ${total}. Verified ${short(target.head)} merged with ${target.base} ${short(target.baseSha)}.`);
  console.log(`Merge: gh pr merge ${pr} --squash --delete-branch --match-head-commit ${target.head}`);
  return 0;
}



/**
 * Returns seconds elapsed since a start time.
 *
 * Purpose: Time steps and the whole run alike.
 *
 * @param started Start time in milliseconds.
 * @returns Elapsed seconds.
 */
function secondsSince(started) {
  // Date.now is precise enough for minute-long steps.
  return (Date.now() - started) / 1000;
}

