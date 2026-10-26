// Creates, prepares, and removes the worktree behind each agent.
// Setup commands come from the project's command-center.json.

import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadConfig, readConfigFile } from "../../config/load.mjs";
import { mainCheckout, worktreePath } from "../../config/paths.mjs";
import { assertInstanceName } from "../names.mjs";
import { exec } from "./git.mjs";

/** Marker in a worktree's git folder: prepared lockfile hash. */
const PREPARED_MARKER = "command-center-prepared";



/**
 * Reads the settings that apply inside one checkout.
 *
 * Purpose: A branch may change its own setup steps.
 *
 * @param target Checkout folder.
 * @returns That checkout's settings, else the main checkout's.
 */
function settingsFor(target) {
  // Branches made before setup have no settings file.
  return readConfigFile(target) ? loadConfig(target, true) : loadConfig(mainCheckout(target));
}



/**
 * Creates a branch, worktree, and installed dependencies.
 *
 * Purpose: Hand an agent a checkout where checks work.
 *
 * @param name Worktree and branch name.
 * @param base Ref the new branch starts from.
 * @returns Absolute worktree path.
 *
 * Side effects: Fetches, adds a worktree, runs setup.
 */
export function createWorktree(name, base) {
  // Refuse unsafe names and existing folders first.
  assertInstanceName(name);
  const main = mainCheckout();
  const target = worktreePath(name);
  if (fs.existsSync(target)) throw new Error(`Worktree already exists: ${target}`);

  // Start from the freshest trunk, then prepare it.
  const remote = hasOrigin(main);
  if (remote) exec("git", ["fetch", "--quiet", "origin"], main);
  const trunk = loadConfig(main).branches.trunk;
  exec("git", ["worktree", "add", "-b", name, target, base ?? (remote ? `origin/${trunk}` : trunk)], main);
  prepareWorktree(target);
  return target;
}



/**
 * Tells whether the project has an origin remote yet.
 *
 * Purpose: New local projects branch from the local trunk.
 *
 * @param main Main checkout path.
 * @returns True when origin exists.
 */
export function hasOrigin(main) {
  // remote get-url fails for a missing remote.
  return spawnSync("git", ["remote", "get-url", "origin"], { cwd: main, stdio: "ignore" }).status === 0;
}



/**
 * Runs the project's setup commands in a worktree.
 *
 * Purpose: Ready any new or moved checkout the same way.
 *
 * @param target Worktree folder to prepare.
 * @returns No value.
 *
 * Side effects: Installs packages; records the lockfile hash.
 */
export function prepareWorktree(target) {
  // Each step is a shell command from the settings.
  for (const command of settingsFor(target).worktrees.setup) {
    const result = spawnSync("sh", ["-c", command], { cwd: target, stdio: ["ignore", "inherit", "inherit"] });
    if (result.status !== 0) throw new Error(`Setup step failed in ${target}: ${command}`);
  }
  recordPrepared(target);
}



/**
 * Records that a worktree's setup matches its lockfiles.
 *
 * Purpose: Later runs skip setup until lockfiles change.
 *
 * @param target Worktree folder.
 * @returns No value.
 *
 * Side effects: Writes the marker in the worktree's git folder.
 */
export function recordPrepared(target) {
  // Hash today's lockfiles into the marker.
  fs.writeFileSync(markerPath(target), lockfileHash(target, settingsFor(target).worktrees.lockfiles));
}



/**
 * Tells whether a worktree needs its setup run again.
 *
 * Purpose: Skip slow installs when lockfiles did not change.
 *
 * @param target Worktree folder.
 * @returns True when never prepared or lockfiles changed.
 */
export function needsPrepare(target) {
  // Compare the recorded hash with today's lockfiles.
  const marker = markerPath(target);
  if (!fs.existsSync(marker)) return true;
  return fs.readFileSync(marker, "utf8") !== lockfileHash(target, settingsFor(target).worktrees.lockfiles);
}



/**
 * Returns the prepared-marker path inside a worktree's git folder.
 *
 * Purpose: Keep the marker out of tracked and cleaned files.
 *
 * @param target Worktree folder.
 * @returns Absolute marker path.
 */
function markerPath(target) {
  // Each worktree has its own git folder.
  return path.resolve(target, exec("git", ["rev-parse", "--git-dir"], target), PREPARED_MARKER);
}



/**
 * Hashes the lockfiles that decide installed packages.
 *
 * Purpose: Any lockfile edit means setup must rerun.
 *
 * @param target Worktree folder.
 * @param lockfiles Lockfile paths relative to the worktree.
 * @returns Hex digest; missing files count as empty.
 */
export function lockfileHash(target, lockfiles) {
  // Name and bytes both feed the hash.
  const hash = crypto.createHash("sha256");
  for (const file of lockfiles) {
    const full = path.join(target, file);
    hash.update(file).update(fs.existsSync(full) ? fs.readFileSync(full) : "");
  }
  return hash.digest("hex");
}



/**
 * Reports whether a branch's work reached the trunk.
 *
 * Purpose: Treat squash-merged pull requests as merged too.
 *
 * @param name Branch name.
 * @param main Main checkout path.
 * @returns Whether deleting the branch loses no work.
 */
function isMerged(name, main) {
  // Plain merges leave the branch inside the trunk.
  const trunk = `origin/${loadConfig(main).branches.trunk}`;
  if (spawnSync("git", ["merge-base", "--is-ancestor", name, trunk], { cwd: main }).status === 0) return true;

  // Squash merges only show up as a merged pull request.
  const pr = spawnSync("gh", ["pr", "list", "--head", name, "--state", "merged", "--json", "number", "--jq", "length"], { cwd: main, encoding: "utf8" });
  return pr.status === 0 && Number(pr.stdout.trim()) > 0;
}



/**
 * Removes a worktree and, when merged, its branch.
 *
 * Purpose: Return disk and branch names after an issue ships.
 *
 * @param name Worktree and branch name.
 * @param options Force removal of unmerged or dirty work.
 * @returns Whether the branch was deleted too.
 *
 * Side effects: Deletes files; prunes git worktree metadata.
 */
export function removeWorktree(name, { force = false } = {}) {
  // Never discard uncommitted work without an explicit force.
  assertInstanceName(name);
  const main = mainCheckout();
  const target = worktreePath(name);
  if (fs.existsSync(target) && !force && exec("git", ["status", "--porcelain"], target)) {
    throw new Error(`${name} has uncommitted changes; commit them or pass --force.`);
  }

  // Delete the folder, then let git forget it.
  fs.rmSync(target, { recursive: true, force: true });
  exec("git", ["worktree", "prune"], main);

  // Keep unmerged branches unless the caller forces deletion.
  if (!isMerged(name, main) && !force) return false;
  return spawnSync("git", ["branch", "-D", name], { cwd: main, stdio: "ignore" }).status === 0;
}
