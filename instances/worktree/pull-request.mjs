// Checks out a PR's merge result as worktree pr-<n>.
// The current base with the PR merged, rebuilt each run.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { mainCheckout, worktreePath } from "../../config/paths.mjs";
import { assertCapacity, startStack, stopStack } from "../stacks/lifecycle.mjs";
import { readRegistry } from "../stacks/registry.mjs";
import { printRecord } from "../stacks/status.mjs";
import { needsPrepare, prepareWorktree } from "./create.mjs";
import { exec, headOf, isDirty } from "./git.mjs";



/**
 * Refuses pull requests that can no longer merge.
 *
 * Purpose: Fail before any fetch or tree change.
 *
 * @param number Pull request number, for messages.
 * @param pr State and base branch from GitHub.
 * @returns No value; throws when the PR is not open.
 */
export function assertOpen(number, pr) {
  // Only open pull requests have a merge to test.
  if (pr.state !== "OPEN") throw new Error(`#${number} is ${String(pr.state).toLowerCase()}, not open.`);
}



/**
 * Computes the merged tree without touching any worktree.
 *
 * Purpose: Find conflicts before a running stack stops.
 *
 * @param number Pull request number, for messages.
 * @param target PR head, base commit, and base branch name.
 * @param cwd Any checkout of the repository.
 * @returns Tree hash of the base merged into the head.
 */
export function mergeTree(number, target, cwd) {
  // Exit 1 means conflicts; other failures are errors.
  const result = spawnSync("git", ["merge-tree", "--write-tree", target.head, target.base], { cwd, encoding: "utf8" });
  if (result.status === 1) throw new Error(`#${number} conflicts with ${target.baseName}; resolve the conflict first.`);
  if (result.status !== 0) throw new Error(`git merge-tree failed for #${number}: ${result.stderr.trim()}`);
  return result.stdout.split("\n")[0].trim();
}



/**
 * Merges the base into a tree at the PR head.
 *
 * Purpose: Build what a squash merge lands, like cc verify.
 *
 * Side effects: Moves HEAD and writes one merge commit.
 *
 * @param number Pull request number, for messages.
 * @param target PR head, base commit, and base branch name.
 * @param worktree Worktree already detached at the head.
 * @returns No value; throws and aborts on conflict.
 */
export function mergeBase(number, target, worktree) {
  // Same direction as cc verify: base merged into head.
  const merge = spawnSync("git", ["merge", "--no-edit", "--quiet", target.base], { cwd: worktree, encoding: "utf8" });
  if (merge.status === 0) return;

  // Leave the tree clean before reporting the conflict.
  spawnSync("git", ["merge", "--abort"], { cwd: worktree, stdio: "ignore" });
  throw new Error(`#${number} conflicts with ${target.baseName}; resolve the conflict first.`);
}



/**
 * Checks out a PR's merge result, restarting a running stack.
 *
 * Purpose: Let the owner test a PR as if merged.
 *
 * Side effects: Fetches, moves or adds a worktree, restarts.
 *
 * @param number Pull request number.
 * @param options Whether to start its stack afterwards.
 * @returns Worktree path.
 */
export async function checkoutPullRequest(number, { up = false } = {}) {
  // Check the number and capacity before slow work.
  if (!/^\d+$/.test(String(number ?? ""))) throw new Error("--pr needs a pull request number.");
  const name = `pr-${number}`;
  if (up) assertCapacity(readRegistry(), name);
  const main = mainCheckout();
  const target = fetchTarget(number, main);
  const tree = mergeTree(number, target, main);

  // Never discard edits someone made inside the tree.
  const worktree = worktreePath(name);
  const exists = fs.existsSync(worktree);
  if (exists && isDirty(worktree)) throw new Error(`${worktree} has local changes; commit or discard them first.`);
  const moving = !exists || treeOf(worktree) !== tree;

  // Stop a running stack while its files change underneath.
  const registry = readRegistry();
  const restart = moving && Boolean(registry.instances[name]);
  if (restart) {
    console.log("Stopping the stack while its tree moves…");
    await stopStack(name);
  }

  // Move to the head, merge the base, then install.
  if (moving) {
    moveWorktree(worktree, target.head, main);
    mergeBase(number, target, worktree);
  }
  if (moving || needsPrepare(worktree)) {
    console.log("Running the project's worktree setup…");
    prepareWorktree(worktree);
  }
  console.log(`Worktree ${worktree} at ${headOf(worktree).slice(0, 9)}: ${target.baseName} with #${number} merged`);

  // Start on request, or restore a restarted stack.
  if (up || restart) printRecord(await startStack(name, worktree));
  return worktree;
}



/**
 * Fetches the PR head and its current base branch.
 *
 * Purpose: Merge against today's base, not GitHub's cached merge.
 *
 * Side effects: Updates refs/pull/<n>/head and origin/<base>.
 *
 * @param number Pull request number.
 * @param main Main checkout path.
 * @returns PR head, base commit, and base branch name.
 */
function fetchTarget(number, main) {
  // Refuse closed PRs before fetching anything.
  const pr = viewPullRequest(number, main);
  assertOpen(number, pr);

  // Fetch into named refs; FETCH_HEAD is shared.
  const baseName = pr.baseRefName;
  const headRef = `refs/pull/${number}/head`;
  const baseRef = `refs/remotes/origin/${baseName}`;
  console.log(`Fetching #${number} and ${baseName}…`);
  exec("git", ["fetch", "--quiet", "--no-tags", "origin", `+${headRef}:${headRef}`, `+refs/heads/${baseName}:${baseRef}`], main);
  const [head, base] = exec("git", ["rev-parse", headRef, baseRef], main).split("\n");
  return { head, base, baseName };
}



/**
 * Reads one pull request's state and base branch.
 *
 * Purpose: Learn if it is open and its base.
 *
 * @param number Pull request number.
 * @param main Main checkout path.
 * @returns State and base branch name.
 */
function viewPullRequest(number, main) {
  // Only these two fields decide the checkout.
  const result = spawnSync("gh", ["pr", "view", String(number), "--json", "state,baseRefName"], { cwd: main, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`gh pr view ${number} failed: ${result.stderr.trim()}`);
  return JSON.parse(result.stdout);
}



/**
 * Reads the tree a worktree's HEAD points at.
 *
 * Purpose: Tell whether the checkout already holds this merge.
 *
 * @param worktree Worktree folder.
 * @returns Tree hash of HEAD.
 */
function treeOf(worktree) {
  // Equal trees mean equal files, whatever the commit.
  return exec("git", ["rev-parse", "HEAD^{tree}"], worktree);
}



/**
 * Points a pr-<n> worktree at one commit.
 *
 * Purpose: Create the checkout once, then refresh it in place.
 *
 * Side effects: Adds a worktree or detaches it there.
 *
 * @param worktree Worktree folder.
 * @param sha Commit to check out.
 * @param main Main checkout path.
 * @returns No value.
 */
function moveWorktree(worktree, sha, main) {
  // Detached on purpose: there is no branch to move.
  if (fs.existsSync(worktree)) exec("git", ["checkout", "--quiet", "--detach", sha], worktree);
  else exec("git", ["worktree", "add", "--quiet", "--detach", worktree, sha], main);
}
