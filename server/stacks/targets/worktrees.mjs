// Builds Status rows for local worktrees no other row covers.
// Lets the owner run stale, pr-*, or ad hoc checkouts.

import path from "node:path";
import { validName } from "../../../instances/names.mjs";



/**
 * Lists rows for worktrees that no shown row covers.
 *
 * Purpose: Offer every local checkout, without duplicates.
 *
 * @param worktrees Worktrees from git worktree list.
 * @param shown Rows already listed, with instance and worktree.
 * @param repoRoot Main checkout path, which the trunk row covers.
 * @returns Worktree targets sorted by folder name.
 */
export function worktreeTargets(worktrees, shown, repoRoot) {
  // Rows cover worktrees by folder or stack name.
  const folders = new Set([repoRoot, ...shown.map((row) => row.worktree)].filter(Boolean).map((item) => path.resolve(item)));
  const names = new Set(shown.map((row) => row.instance).filter(Boolean));
  return worktrees
    .filter((item) => !item.prunable && !folders.has(path.resolve(item.path)))
    .map(worktreeTarget)
    .filter((row) => !names.has(row.instance))
    .sort((a, b) => a.title.localeCompare(b.title));
}



/**
 * Builds the row for one worktree.
 *
 * Purpose: Run whatever that folder has checked out.
 *
 * @param item Worktree with path, head, and branch.
 * @returns Worktree target named after its folder.
 */
function worktreeTarget(item) {
  // Instances are named after their worktree folder.
  const name = path.basename(item.path);
  return {
    id: `worktree-${name}`, kind: "worktree", label: "", title: name,
    branch: item.branch ?? `detached at ${String(item.head).slice(0, 9)}`,
    instance: validName(name) ? name : null, worktree: item.path,
  };
}



/**
 * Lists pr-<n> worktrees whose PR is no longer open.
 *
 * Purpose: Remove finished merge previews, never on doubt.
 *
 * @param worktrees Worktrees from git worktree list.
 * @param prs Open pull requests from GitHub.
 * @param github Fetch time and error of that GitHub answer.
 * @returns Folder names such as pr-41, or none.
 */
export function finishedPreviews(worktrees, prs, github) {
  // Without a fresh, successful answer, nothing counts as finished.
  if (!github?.at || github.error) return [];
  const open = new Set(prs.map((pr) => `pr-${pr.number}`));
  return worktrees.map((item) => path.basename(item.path)).filter((name) => /^pr-\d+$/.test(name) && !open.has(name));
}



// Rows reuse the shared name rule.
export { validName };
