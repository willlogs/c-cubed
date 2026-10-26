// Names issue branches and finds an issue's existing worktree.
// Shared by Status and workers: one branch per issue.

import fs from "node:fs";
import path from "node:path";
import { worktreePath } from "../../config/paths.mjs";



/**
 * Builds a valid branch and worker name from an issue.
 *
 * Purpose: Match the instance and branch naming rules.
 *
 * @param issue Issue number.
 * @param slug Short words, or the issue title.
 * @returns Name such as issue-42-board-picker.
 */
export function workerName(issue, slug) {
  // Keep lowercase letters, digits, and single dashes.
  const clean = String(slug ?? "work").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const full = `issue-${issue}-${clean}`;
  if (full.length <= 41) return full;

  // Cut at the last whole word that fits.
  const cut = full.slice(0, 42);
  return cut.slice(0, cut.lastIndexOf("-")) || full.slice(0, 41);
}



/**
 * Finds the worktree folder already made for an issue.
 *
 * Purpose: Reuse it instead of branching a second time.
 *
 * @param issue Issue number.
 * @returns Folder name such as issue-42-board-picker, or null.
 */
export function existingIssueWorktree(issue) {
  // Worktrees live side by side in one folder.
  const folder = path.dirname(worktreePath("probe"));
  if (!fs.existsSync(folder)) return null;
  const prefix = `issue-${issue}-`;
  return fs.readdirSync(folder).find((name) => name.startsWith(prefix) && fs.existsSync(path.join(folder, name, ".git"))) ?? null;
}
