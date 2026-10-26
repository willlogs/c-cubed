// Runs the command-center script as people will: help, init, new.
// Uses --yes and --no-install, so nothing waits or downloads.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

/** The script under test. */
const BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "command-center.mjs");



/**
 * Runs the script with arguments.
 *
 * Purpose: Check exit codes and output together.
 *
 * @param args Script arguments.
 * @returns Exit status and combined output.
 */
function run(args) {
  // Standard input is closed, so nothing prompts.
  const result = spawnSync(process.execPath, [BIN, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}



test("help prints usage", () => {
  // help succeeds; unknown commands fail.
  assert.equal(run(["help"]).status, 0);
  assert.match(run(["help"]).output, /init \[dir\]/);
  assert.equal(run(["bogus"]).status, 1);
});



test("init refuses a folder without git", () => {
  // The message points at new.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cc-bin-"));
  const result = run(["init", dir, "--yes", "--no-install"]);
  assert.equal(result.status, 1);
  assert.match(result.output, /command-center new/);
});



test("new creates a project with the kit", () => {
  // A fresh repository on the chosen trunk.
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "cc-bin-")), "acme");
  const result = run(["new", dir, "--yes", "--no-install", "--owner", "Will", "--trunk", "trunk"]);
  assert.equal(result.status, 0, result.output);
  assert.match(result.output, /npm run command-center/);

  // Settings, scripts, and kit code are all there.
  const config = JSON.parse(fs.readFileSync(path.join(dir, "command-center.json"), "utf8"));
  assert.deepEqual([config.project, config.owner, config.branches.trunk], ["acme", "Will", "trunk"]);
  assert.ok(JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).scripts["command-center"]);
  assert.ok(fs.existsSync(path.join(dir, "tools/command-center/package.json")));

  // new refuses a folder that is not empty.
  assert.equal(run(["new", dir, "--yes", "--no-install"]).status, 1);
});
