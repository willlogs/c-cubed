// Checks out a PR merged with its current base.
// Reusing it keeps node_modules, so most runs skip npm ci.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { loadConfig } from "../../config/load.mjs";
import { mainCheckout, worktreePath } from "../../config/paths.mjs";

/** Worktree name beside agent worktrees: <project>-wt/verify-pr. */
export const VERIFY_WORKTREE = "verify-pr";



/**
 * Runs git and returns trimmed output.
 *
 * Purpose: Fail with git's own message on errors.
 *
 * @param args Git arguments.
 * @param cwd Folder where git runs.
 * @returns Trimmed standard output.
 */
function git(args, cwd) {
  // Surface stderr in the thrown error.
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${result.stderr.trim()}`);
  return result.stdout.trim();
}



/**
 * Reads a pull request's state and base branch.
 *
 * Purpose: Refuse closed PRs and merge the right base.
 *
 * @param pr Pull request number.
 * @returns State and base branch name.
 */
function describePullRequest(pr) {
  // gh resolves the repository from the main checkout.
  const result = spawnSync("gh", ["pr", "view", pr, "--json", "state,baseRefName"], { cwd: mainCheckout(), encoding: "utf8" });
  if (result.status !== 0) throw new Error(`gh pr view ${pr}: ${result.stderr.trim()}`);
  const { state, baseRefName } = JSON.parse(result.stdout);
  return { state, base: baseRefName };
}



/**
 * Returns the verify worktree, creating it on first use.
 *
 * Purpose: Keep one checkout whose node_modules survives runs.
 *
 * Inputs: None.
 *
 * Side effects: May add a detached git worktree.
 *
 * @returns Absolute worktree path.
 */
function ensureWorktree() {
  // Reuse the existing checkout when it is there.
  const target = worktreePath(VERIFY_WORKTREE);
  if (fs.existsSync(target)) return target;

  // Detached, so it never holds a branch others need.
  git(["worktree", "add", "--detach", "--quiet", target, `origin/${loadConfig().branches.trunk}`], mainCheckout());
  return target;
}



/**
 * Checks out a PR head and merges its current base.
 *
 * Purpose: Verify the exact tree a squash merge would land.
 *
 * Side effects: Fetches, resets, cleans, and merges in the worktree.
 *
 * @param pr Pull request number.
 * @returns Worktree, PR head SHA, base name, base SHA.
 */
export function checkoutPullRequest(pr) {
  // Only open pull requests can still be merged.
  const { state, base } = describePullRequest(pr);
  if (state !== "OPEN") throw new Error(`PR #${pr} is ${state.toLowerCase()}, not open.`);

  // Drop the last run's files, keeping installed packages.
  const worktree = ensureWorktree();
  spawnSync("git", ["merge", "--abort"], { cwd: worktree, stdio: "ignore" });
  git(["reset", "--hard", "--quiet"], worktree);
  git(["clean", "-ffdxq", "-e", "node_modules"], worktree);

  // Fetch the current base, then the PR head.
  git(["fetch", "--quiet", "--no-tags", "origin", `+refs/heads/${base}:refs/remotes/origin/${base}`], worktree);
  git(["fetch", "--quiet", "--no-tags", "origin", `refs/pull/${pr}/head`], worktree);
  const head = git(["rev-parse", "FETCH_HEAD"], worktree);
  const baseSha = git(["rev-parse", `origin/${base}`], worktree);

  // Merge the base into the head, as the squash will.
  git(["checkout", "--quiet", "--detach", head], worktree);
  const merge = spawnSync("git", ["merge", "--no-edit", "--quiet", baseSha], { cwd: worktree, encoding: "utf8" });
  if (merge.status !== 0) {
    spawnSync("git", ["merge", "--abort"], { cwd: worktree, stdio: "ignore" });
    throw new Error(`PR #${pr} conflicts with ${base}; send it back to its worker.`);
  }
  return { worktree, head, base, baseSha };
}
