// Turns GitHub and git facts into live Status rows.
// Pure functions: row rules test without stacks or GitHub.

import path from "node:path";
import { KIT_FOLDER } from "../../../config/defaults.mjs";
import { loadConfig } from "../../../config/load.mjs";
import { workerName } from "../../roles/names.mjs";
import { validName, worktreeTargets } from "./worktrees.mjs";

/** Stack that runs the trunk from the main checkout. */
export const TRUNK = "trunk";

/** Issues with these labels are not work anyone runs. */
const NOT_WORK = ["decision", "daily-plan"];

/** Changes under this folder earn a command center preview. */
const COMMAND_CENTER = `${KIT_FOLDER}/`;



/**
 * Lists Status rows: trunk, PRs, issues, other worktrees.
 *
 * Purpose: Show all open work the owner can check out.
 *
 * @param sources Open PRs and issues, branch names, worktrees.
 * @param repoRoot Main checkout path, where the trunk runs.
 * @param trunk Trunk branch name.
 * @returns Trunk, newest PRs, newest issues, then worktrees.
 */
export function buildTargets({ prs, issues, branches, worktrees }, repoRoot, trunk = loadConfig(repoRoot).branches.trunk) {
  // The trunk always runs from the main checkout.
  const main = { id: "trunk", kind: "trunk", section: "trunk", label: trunk, title: "Trunk: everything merged so far", branch: trunk, instance: TRUNK, worktree: repoRoot };
  const pulls = [...prs].sort((a, b) => b.number - a.number).map((pr) => pullTarget(pr, worktrees));

  // An issue with an open PR shows as that PR.
  const prBranches = prs.map((pr) => pr.headRefName ?? "");
  const work = issues.filter((issue) => isWork(issue) && !prBranches.some((branch) => branch.startsWith(`issue-${issue.number}-`)));
  const rows = work.sort((a, b) => b.number - a.number).map((issue) => issueTarget(issue, branches, worktrees));
  const shown = [main, ...pulls, ...rows];

  // Every other local worktree, minus duplicates.
  return [...shown, ...worktreeTargets(worktrees, shown, repoRoot).map((row) => ({ ...row, section: "worktrees" }))];
}



/**
 * Tells whether an issue is work someone runs.
 *
 * Purpose: Leave decisions and daily plans off Status.
 *
 * @param issue Open issue with its labels.
 * @returns False for decision and daily-plan issues.
 */
function isWork(issue) {
  // Labels mark questions and plans.
  return !(issue.labels ?? []).some((label) => NOT_WORK.includes(label.name));
}



/**
 * Builds the row for one open pull request.
 *
 * Purpose: Run the PR's merge result as pr-<n>.
 *
 * @param pr Pull request from gh pr list.
 * @param worktrees Worktrees, to find its pr-<n> preview.
 * @returns PR target.
 */
function pullTarget(pr, worktrees) {
  // Conflicts block Start; command center changes add Preview.
  const files = pr.files ?? [];
  const preview = worktrees.find((item) => path.basename(item.path) === `pr-${pr.number}`);
  return {
    id: `pr-${pr.number}`, kind: "pr", section: "prs", number: pr.number, label: `#${pr.number}`, title: pr.title, url: pr.url,
    branch: pr.headRefName, instance: `pr-${pr.number}`, worktree: preview?.path ?? null, draft: Boolean(pr.isDraft),
    conflict: pr.mergeable === "CONFLICTING",
    commandCenter: files.some((file) => file.path.startsWith(COMMAND_CENTER)),
  };
}



/**
 * Builds the row for one open issue.
 *
 * Purpose: Offer a worktree, then a stack, for any work.
 *
 * @param issue Open issue from gh issue list.
 * @param branches Local and origin branch names.
 * @param worktrees Worktrees with their checked-out branch.
 * @returns Issue target; newBranch names a branch to create.
 */
function issueTarget(issue, branches, worktrees) {
  // Prefer a checked-out branch, then any existing one.
  const prefix = `issue-${issue.number}-`;
  const checkedOut = worktrees.find((item) => item.branch?.startsWith(prefix));
  const branch = checkedOut?.branch ?? branches.find((name) => name.startsWith(prefix)) ?? null;
  const name = branch ?? workerName(issue.number, issue.title);
  return {
    id: `issue-${issue.number}`, kind: "issue", section: "issues", number: issue.number, label: `#${issue.number}`,
    title: issue.title, url: issue.url, branch, newBranch: branch ? null : name,
    instance: validName(name) ? name : null, worktree: checkedOut?.path ?? null,
  };
}



/**
 * Adds live stack, job, preview, and worker state to targets.
 *
 * Purpose: Give the Status tab everything one row shows.
 *
 * @param targets Rows from buildTargets.
 * @param live Stack status, jobs, previews, and live workers.
 * @returns Rows, plus stacks and previews no row covers.
 */
export function joinRows(targets, { status, jobs, previews, workers }) {
  // Index recorded stacks by instance name.
  const records = new Map(status.instances.map((item) => [item.name, item]));
  const rows = targets.map((target) => {
    // A running stack knows its real worktree.
    const record = records.get(target.instance);
    const worktree = record?.worktree ?? target.worktree;
    return {
      ...target, worktree, state: record?.state ?? "stopped", stackUrl: record?.url ?? null,
      worker: workerFor(target.instance, worktree, workers),
      job: jobs[target.id] ?? null, preview: previews[target.id] ?? null,
    };
  });

  // Stacks and previews outside every row stay stoppable.
  const covered = new Set(targets.map((target) => target.instance));
  const others = status.instances.filter((item) => !covered.has(item.name)).map((item) => ({
    id: `stack-${item.name}`, name: item.name, branch: item.branch, state: item.state, stackUrl: item.url,
    worker: workerFor(item.name, item.worktree, workers), job: jobs[`stack-${item.name}`] ?? null,
  }));
  const ids = new Set(targets.map((target) => target.id));
  const strayPreviews = Object.entries(previews).filter(([id]) => !ids.has(id)).map(([id, preview]) => ({ id, ...preview }));
  return { rows, others, strayPreviews };
}



/**
 * Names the live worker that owns an instance.
 *
 * Purpose: Warn before stopping a stack a worker uses.
 *
 * @param instance Instance name, which workers share with their branch.
 * @param worktree Folder the instance mounts, if known.
 * @param workers Live worker sessions with name and cwd.
 * @returns Worker session name, or null.
 */
export function workerFor(instance, worktree, workers) {
  // Workers name their stack after their branch, in their cwd.
  const folder = worktree ? path.resolve(worktree) : null;
  const owner = workers.find((item) => item.name === instance || (folder && path.resolve(item.cwd) === folder));
  return owner?.name ?? null;
}
