// Runs timed verify steps quietly, keeping each one's log.
// Each step logs to its own file for later reading.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Log lines printed when a step fails. */
const TAIL_LINES = 40;



/**
 * Runs one command with output captured in a log file.
 *
 * Purpose: Time a step without flooding the master's terminal.
 *
 * Side effects: Spawns the command; writes the log file.
 *
 * @param step Name, command, arguments, folder, and log folder.
 * @returns Whether it passed, its seconds, and its log path.
 */
export function runStep({ name, command, args, cwd, logDir }) {
  // Send stdout and stderr to one log per step.
  const logFile = path.join(logDir, `${name.replace(/[^a-z0-9-]/gi, "-")}.log`);
  const log = fs.openSync(logFile, "w");
  const started = Date.now();

  // Run with npm's own variables removed, so cwd decides.
  const result = spawnSync(command, args, { cwd, env: childEnv(), stdio: ["ignore", log, log] });
  fs.closeSync(log);
  return { ok: result.status === 0, seconds: (Date.now() - started) / 1000, logFile };
}



/**
 * Copies the environment without npm's run-script variables.
 *
 * Purpose: Force full turbo runs in the verify worktree.
 *
 * Inputs: None.
 *
 * @returns Environment for child commands.
 */
function childEnv() {
  // Turbo's cache misses examples and base tsconfig edits.
  const env = { ...process.env, TURBO_FORCE: "true" };

  // npm run exports these for the caller's own checkout.
  for (const key of Object.keys(env)) {
    if (key.startsWith("npm_") || key === "INIT_CWD") delete env[key];
  }
  return env;
}



/**
 * Returns the last lines of a step's log.
 *
 * Purpose: Show why a step failed without opening files.
 *
 * @param logFile Log written by runStep.
 * @returns Up to forty trailing lines.
 */
export function logTail(logFile) {
  // Trailing output usually holds the failure summary.
  return fs.readFileSync(logFile, "utf8").trimEnd().split("\n").slice(-TAIL_LINES).join("\n");
}
