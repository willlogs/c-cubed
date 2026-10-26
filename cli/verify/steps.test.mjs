// Tests the npm ci decision and the quiet step runner.
// Run with: node --test <this file>

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { logTail, runStep } from "./steps.mjs";



/**
 * Creates a throwaway worktree with a lockfile.
 *
 * Purpose: Keep each test's setup to one call.
 *
 * @param lockfile Lockfile text to write.
 * @returns Folder path holding package-lock.json and node_modules.
 */
function fakeWorktree(lockfile) {
  // node_modules exists, as after an install.
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), "cc-verify-test-"));
  fs.mkdirSync(path.join(folder, "node_modules"));
  fs.writeFileSync(path.join(folder, "package-lock.json"), lockfile);
  return folder;
}



test("a failing step reports failure and keeps its output", () => {
  // Arrange a command that prints, then exits non-zero.
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-verify-logs-"));
  const script = "console.log('first'); console.error('boom'); process.exit(3)";

  // Run it the way verify runs npm.
  const result = runStep({ name: "check:style", command: process.execPath, args: ["-e", script], cwd: logDir, logDir });
  assert.equal(result.ok, false);
  assert.ok(result.seconds >= 0);
  assert.equal(path.basename(result.logFile), "check-style.log");
  assert.equal(logTail(result.logFile), "first\nboom");
});



test("child steps run with turbo forced and no npm variables", () => {
  // Arrange a step that prints the variables it sees.
  const logDir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-verify-logs-"));
  const script = "console.log(process.env.TURBO_FORCE, process.env.npm_package_name ?? 'none')";
  process.env.npm_package_name = "caller";

  // The child sees forced turbo and no caller package.
  const result = runStep({ name: "env", command: process.execPath, args: ["-e", script], cwd: logDir, logDir });
  delete process.env.npm_package_name;
  assert.equal(result.ok, true);
  assert.equal(logTail(result.logFile), "true none");
});
