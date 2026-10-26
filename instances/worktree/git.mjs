// Answers small git questions for worktrees and pull request checkouts.
// Keeps porcelain parsing in one place the command center reuses.

import { spawnSync } from "node:child_process";



/**
 * Runs one command and fails loudly on errors.
 *
 * Purpose: Keep every git and setup step visible to agents.
 *
 * @param command Executable to run.
 * @param args Command arguments.
 * @param cwd Folder where the command runs.
 * @returns Trimmed standard output.
 */
export function exec(command, args, cwd) {
  // Inherit stderr so failures explain themselves.
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed in ${cwd}`);
  return result.stdout.trim();
}



/**
 * Parses `git worktree list --porcelain` output.
 *
 * Purpose: Find which folder holds which branch.
 *
 * @param porcelain Raw porcelain text from git.
 * @returns Worktrees: path, head, branch or null, prunable.
 */
export function parseWorktrees(porcelain) {
  // Blank lines separate one worktree's attribute lines.
  return String(porcelain ?? "").split(/\n\s*\n/).filter((block) => block.trim()).map((block) => {
    // Detached worktrees have no branch line.
    const fields = Object.fromEntries(block.split("\n").map((line) => [line.split(" ")[0], line.slice(line.indexOf(" ") + 1)]));
    // Prunable worktrees point at a deleted folder.
    const branch = fields.branch?.replace(/^refs\/heads\//, "") ?? null;
    return { path: fields.worktree, head: fields.HEAD, branch, prunable: "prunable" in fields };
  });
}



/**
 * Finds the worktree that has a branch checked out.
 *
 * Purpose: Reuse a worker's checkout instead of adding another.
 *
 * @param branch Branch name without refs/heads/.
 * @param main Main checkout path.
 * @returns Worktree path, or undefined when none has it.
 */
export function worktreeOf(branch, main) {
  // Git allows each branch in only one worktree.
  const listed = parseWorktrees(exec("git", ["worktree", "list", "--porcelain"], main));
  return listed.find((item) => item.branch === branch)?.path;
}



/**
 * Reports whether a ref exists in the shared repository.
 *
 * Purpose: Tell local branches from origin-only ones.
 *
 * @param ref Full ref name such as refs/heads/x.
 * @param main Main checkout path.
 * @returns True when git knows the ref.
 */
export function refExists(ref, main) {
  // show-ref exits non-zero for a missing ref.
  return spawnSync("git", ["show-ref", "--verify", "--quiet", ref], { cwd: main }).status === 0;
}



/**
 * Reads the commit a worktree has checked out.
 *
 * Purpose: Skip work when a checkout is already current.
 *
 * @param worktree Worktree folder.
 * @returns Full commit hash.
 */
export function headOf(worktree) {
  // rev-parse prints the full hash.
  return exec("git", ["rev-parse", "HEAD"], worktree);
}



/**
 * Reports whether a worktree has uncommitted changes.
 *
 * Purpose: Never overwrite someone's edits when refreshing.
 *
 * @param worktree Worktree folder.
 * @returns True when git status lists any change.
 */
export function isDirty(worktree) {
  // Ignored files such as node_modules never count.
  return exec("git", ["status", "--porcelain"], worktree) !== "";
}



/**
 * Reads the branch checked out in a worktree.
 *
 * Purpose: Record which branch a stack runs.
 *
 * @param worktree Worktree folder.
 * @returns Branch name, or detached.
 */
export function gitBranch(worktree) {
  // Git names a detached HEAD just HEAD.
  const result = spawnSync("git", ["-C", worktree, "rev-parse", "--abbrev-ref", "HEAD"], { encoding: "utf8" });
  const branch = result.stdout?.trim();
  return result.status === 0 && branch && branch !== "HEAD" ? branch : "detached";
}
