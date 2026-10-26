// Creates and removes Status rows' worktrees through the instances CLI.
// Also clears finished PR merge previews once their PR closes.

import { loadConfig } from "../../../config/load.mjs";
import { workerFor } from "../targets/rows.mjs";
import { liveWorkers } from "./actions.mjs";
import { runCli, runJob } from "./jobs.mjs";
import { listPreviews, stopPreview } from "./preview.mjs";

/** Finished previews already tried, so failures do not loop. */
const tried = new Set();



/**
 * Builds the CLI arguments that create a row's worktree.
 *
 * Purpose: PRs check out their merge; issues reuse or branch.
 *
 * @param target Row target without a worktree.
 * @returns Arguments for the instances CLI.
 */
function createArgs(target) {
  // Issues without a branch get a new one from trunk.
  if (target.kind === "pr") return ["checkout", "--pr", String(target.number)];
  if (target.kind === "issue" && target.newBranch) return ["new", target.newBranch];
  if (target.kind === "issue") return ["checkout", target.branch];
  throw new Error(`${target.label || target.title} has no worktree to create.`);
}



/**
 * Creates one row's worktree, leaving its stack stopped.
 *
 * Purpose: The first click: PR or issue to checkout.
 *
 * Side effects: Adds a worktree, may add a branch, installs.
 *
 * @param repoRoot Main checkout path.
 * @param target Row target from buildTargets.
 * @returns The job's summary.
 */
export function createWorktree(repoRoot, target) {
  // Conflicting PRs have no merge result to check out.
  if (target.worktree) throw new Error(`${target.label} already has a worktree.`);
  if (target.conflict) throw new Error(`${target.label} conflicts with ${loadConfig().branches.trunk}; resolve the conflict first.`);
  return runJob(target.id, "worktree", (log) => runCli(repoRoot, createArgs(target), log), { exclusive: true });
}



/**
 * Removes one row's worktree and stops its stack.
 *
 * Purpose: Clean up a checkout nobody needs anymore.
 *
 * Side effects: Stops containers, deletes the worktree folder.
 *
 * @param repoRoot Main checkout path.
 * @param target Row target with a worktree.
 * @returns The job's summary.
 */
export function removeTarget(repoRoot, target) {
  // Never the main checkout, and never under a live worker.
  if (target.kind === "trunk") throw new Error("The trunk runs from the main checkout; there is no worktree to remove.");
  if (!target.worktree) throw new Error(`${target.label || target.title} has no worktree.`);
  const owner = workerFor(target.instance, target.worktree, liveWorkers());
  if (owner) throw new Error(`Worker ${owner} runs in this worktree; stop the worker first.`);

  // A running preview stops before its folder goes.
  return runJob(target.id, "remove", async (log) => {
    // The CLI refuses uncommitted changes and keeps unmerged branches.
    if (listPreviews()[target.id]) await stopPreview(target.id);
    await runCli(repoRoot, ["remove", target.instance], log);
  });
}



/**
 * Removes finished PR merge previews in the background.
 *
 * Purpose: Remove pr-<n> worktrees once their PR closes.
 *
 * Side effects: Starts one removal job per new finished preview.
 *
 * @param repoRoot Main checkout path.
 * @param names Folder names from finishedPreviews.
 * @returns No value.
 */
export function removeFinished(repoRoot, names) {
  // Each preview is tried once per server run.
  for (const name of names.filter((item) => !tried.has(item))) {
    tried.add(name);
    try {
      runJob(name, "remove", async (log) => {
        // Stop its command center preview, then remove.
        if (listPreviews()[name]) await stopPreview(name);
        await runCli(repoRoot, ["remove", name], log);
      });
    } catch {
      // A busy row retries on the next server start.
    }
  }
}
