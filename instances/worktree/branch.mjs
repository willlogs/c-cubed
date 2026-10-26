// Checks out an existing branch, then may start its stack.
// Unlike new, it never branches fresh from the trunk.

import fs from "node:fs";
import { mainCheckout, worktreePath } from "../../config/paths.mjs";
import { assertInstanceName } from "../names.mjs";
import { assertCapacity, startStack } from "../stacks/lifecycle.mjs";
import { readRegistry } from "../stacks/registry.mjs";
import { printRecord } from "../stacks/status.mjs";
import { prepareWorktree } from "./create.mjs";
import { exec, refExists, worktreeOf } from "./git.mjs";



/**
 * Finds or creates the worktree for a branch.
 *
 * Purpose: Let anyone run an issue branch with one command.
 *
 * Side effects: May add a worktree and start containers.
 *
 * @param branch Existing branch, also the instance name.
 * @param options Whether to start its stack afterwards.
 * @returns Worktree path.
 */
export async function checkoutBranch(branch, { up = false } = {}) {
  // Refuse bad names and a full host before slow work.
  assertInstanceName(branch);
  if (up) assertCapacity(readRegistry(), branch);
  const main = mainCheckout();

  // Reuse the worktree that already has this branch.
  const worktree = worktreeOf(branch, main) ?? addBranchWorktree(branch, main);
  console.log(`Worktree ${worktree} on branch ${branch}`);
  if (up) printRecord(await startStack(branch, worktree));
  return worktree;
}



/**
 * Adds a worktree that checks out an existing branch.
 *
 * Purpose: Use the local branch, else track origin's copy.
 *
 * Side effects: Fetches, adds a worktree, installs, builds.
 *
 * @param branch Branch to check out.
 * @param main Main checkout path.
 * @returns New worktree path.
 */
function addBranchWorktree(branch, main) {
  // A folder without this branch is someone else's checkout.
  const target = worktreePath(branch);
  if (fs.existsSync(target)) throw new Error(`${target} exists but does not have ${branch} checked out.`);
  exec("git", ["fetch", "--quiet", "origin"], main);

  // Check out the branch itself, never a fresh one.
  if (refExists(`refs/heads/${branch}`, main)) exec("git", ["worktree", "add", target, branch], main);
  else if (refExists(`refs/remotes/origin/${branch}`, main)) exec("git", ["worktree", "add", "--track", "-b", branch, target, `origin/${branch}`], main);
  else throw new Error(`No branch ${branch} here or on origin.`);

  // Same dependency setup as the new command.
  console.log("Running the project's worktree setup…");
  prepareWorktree(target);
  return target;
}
