// Starts, stops, and previews stacks through the instances CLI.
// Each action is a background job the Status tab watches.

import { loadConfig } from "../../../config/load.mjs";
import { worktreePath } from "../../../config/paths.mjs";
import { listSessions } from "../../sessions/terminals.mjs";
import { workerFor } from "../targets/rows.mjs";
import { runCli, runJob } from "./jobs.mjs";
import { listPreviews, startPreview } from "./preview.mjs";



/**
 * Lists live worker sessions with their folders.
 *
 * Purpose: Tell which stacks a running worker relies on.
 *
 * Inputs: None.
 *
 * @returns Worker names and working folders.
 */
export function liveWorkers() {
  // Only live workers can be mid-check.
  return listSessions().filter((item) => item.kind === "worker" && item.alive).map(({ name, cwd }) => ({ name, cwd }));
}



/**
 * Starts one row's stack, or refreshes a PR's merge result.
 *
 * Purpose: One click from Status to a running stack.
 *
 * Side effects: May add worktrees and start containers.
 *
 * @param repoRoot Main checkout path.
 * @param target Row target from buildTargets.
 * @returns The start job's summary.
 */
export function startTarget(repoRoot, target) {
  // Conflicting PRs have no merge result to run.
  if (target.kind === "other") throw new Error(`${target.label} has no Status row to start from.`);
  if (target.conflict) throw new Error(`${target.label} conflicts with ${loadConfig().branches.trunk}; resolve the conflict first.`);
  return runJob(target.id, "start", async (log) => {
    // A running preview restarts on the refreshed tree.
    await runCli(repoRoot, startArgs(repoRoot, target), log);
    if (listPreviews()[target.id]) await startPreview(target.id, worktreePath(target.instance), log);
  }, { exclusive: true });
}



/**
 * Builds the CLI arguments that start one row.
 *
 * Purpose: Run an existing worktree; PRs refresh their merge.
 *
 * @param repoRoot Main checkout path.
 * @param target Row target.
 * @returns Arguments for the instances CLI.
 */
function startArgs(repoRoot, target) {
  // Starting needs a worktree; Create worktree comes first.
  if (target.kind === "trunk") return ["up", target.instance, "--worktree", repoRoot];
  if (target.kind === "pr") return ["checkout", "--pr", String(target.number), "--up"];
  if (target.worktree) return ["up", target.instance, "--worktree", target.worktree];
  throw new Error(`Create ${target.label}'s worktree first.`);
}



/**
 * Stops one row's stack, keeping its worktree.
 *
 * Purpose: Free memory; ask first under a live worker.
 *
 * Side effects: Stops containers through the CLI.
 *
 * @param repoRoot Main checkout path.
 * @param target Row target.
 * @param force Whether the owner already confirmed.
 * @returns The stop job, or a confirm question.
 */
export function stopTarget(repoRoot, target, force) {
  // down never removes a worktree; remove does.
  const owner = workerFor(target.instance, target.worktree, liveWorkers());
  if (owner && !force) return { confirm: `Worker ${owner} is running and may be using ${target.instance}. Stopping it may break its check.` };
  return runJob(target.id, "stop", (log) => runCli(repoRoot, ["down", target.instance], log));
}



/**
 * Starts a command center from a PR's merge result.
 *
 * Purpose: Try command-center changes before merging them.
 *
 * Side effects: Refreshes the PR worktree and spawns a server.
 *
 * @param repoRoot Main checkout path.
 * @param target PR row that changes the command center.
 * @returns The preview job's summary.
 */
export function previewTarget(repoRoot, target) {
  // Only PRs touching the command center offer this.
  if (target.kind !== "pr" || !target.commandCenter) throw new Error(`${target.label} does not change the command center.`);
  if (target.conflict) throw new Error(`${target.label} conflicts with ${loadConfig().branches.trunk}; resolve the conflict first.`);
  return runJob(target.id, "preview", async (log) => {
    // Checkout without --up leaves a stopped stack stopped.
    await runCli(repoRoot, ["checkout", "--pr", String(target.number)], log);
    await startPreview(target.id, worktreePath(target.instance), log);
  }, { exclusive: true });
}
