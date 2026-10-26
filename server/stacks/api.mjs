// Answers /api/stacks: lists rows and runs row actions.
// Keeps stack actions out of the general routes file.

import { readRegistry } from "../../instances/stacks/registry.mjs";
import { describeStatus } from "../../instances/stacks/status.mjs";
import { liveWorkers, previewTarget, startTarget, stopTarget } from "./run/actions.mjs";
import { listJobs } from "./run/jobs.mjs";
import { listPreviews, stopPreview } from "./run/preview.mjs";
import { createWorktree, removeFinished, removeTarget } from "./run/worktrees.mjs";
import { buildTargets, joinRows } from "./targets/rows.mjs";
import { readSources } from "./targets/sources.mjs";
import { finishedPreviews } from "./targets/worktrees.mjs";



/**
 * Answers one /api/stacks request.
 *
 * Purpose: GET lists rows; POST runs one row's action.
 *
 * @param repoRoot Main checkout path.
 * @param action Path part after /api/stacks/, such as start.
 * @param body POST body naming the row; null on GET.
 * @param fresh Whether a listing skips the GitHub cache.
 * @returns Promise resolving with HTTP status and JSON value.
 */
export async function answerStacks(repoRoot, action, body, fresh) {
  // GET lists; previews stop even without a row.
  if (!body) return [200, await listStacks(repoRoot, fresh)];
  if (action === "unpreview") return [200, { stopped: await stopPreview(body.id) }];
  const target = await findTarget(repoRoot, body.id);
  if (action === "worktree") return [202, createWorktree(repoRoot, target)];
  if (action === "start") return [202, startTarget(repoRoot, target)];
  if (action === "remove") return [202, removeTarget(repoRoot, target)];
  if (action === "preview") return [202, previewTarget(repoRoot, target)];

  // A confirm question answers 409 so the UI can ask.
  const force = body.force === true;
  const result = action === "stop" ? stopTarget(repoRoot, target, force) : null;
  if (!result) return [404, { error: `Unknown stack action ${action}.` }];
  return [result.confirm ? 409 : 202, result];
}



/**
 * Builds the Status tab's full payload.
 *
 * Purpose: Join GitHub, git, stacks, jobs, and sessions once.
 *
 * @param repoRoot Main checkout path.
 * @param fresh Whether to skip the GitHub cache.
 * @returns Rows, other stacks, and stack capacity.
 */
async function listStacks(repoRoot, fresh) {
  // Live state comes from the stacks; finished previews clear themselves.
  const [sources, status] = await Promise.all([readSources(repoRoot, fresh), describeStatus()]);
  removeFinished(repoRoot, finishedPreviews(sources.worktrees, sources.prs, sources.github));
  const live = { status, jobs: listJobs(), previews: listPreviews(), workers: liveWorkers() };
  const view = joinRows(buildTargets(sources, repoRoot), live);

  // Projects without stacks show worktrees only.
  return { ...view, github: sources.github, capacity: { configured: status.configured, running: status.instances.length, max: status.max } };
}



/**
 * Finds the row a POST names.
 *
 * Purpose: Act only on rows Status would show.
 *
 * @param repoRoot Main checkout path.
 * @param id Row id from the UI.
 * @returns The matching target.
 */
async function findTarget(repoRoot, id) {
  // Cached GitHub data is fine; the CLI rechecks PRs.
  const target = buildTargets(await readSources(repoRoot), repoRoot).find((item) => item.id === id) ?? otherStack(id);
  if (!target) throw new Error(`No Status row ${id}; refresh the list.`);
  if (!target.instance) throw new Error(`${target.branch} cannot be an instance name; rename the branch.`);
  return target;
}



/**
 * Builds a target for a rowless running stack.
 *
 * Purpose: Stop a merged PR's or a worker's stack too.
 *
 * @param id Id such as stack-pr-41.
 * @returns Target of kind other, or undefined.
 */
function otherStack(id) {
  // Only stacks the launcher actually recorded qualify.
  const text = String(id ?? "");
  const name = text.replace(/^stack-/, "");
  const record = readRegistry().instances[name];
  if (!text.startsWith("stack-") || !record) return undefined;
  return { id, kind: "other", label: name, branch: record.branch, instance: name };
}
