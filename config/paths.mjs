// Finds the project checkout, worktree folder, and shared state.
// Builtins only, so hooks can import it cheaply.

import { spawnSync } from "node:child_process";
import path from "node:path";



/**
 * Runs git and returns its trimmed output.
 *
 * Purpose: Fail with git's own message.
 *
 * @param args Arguments after git.
 * @param cwd Folder inside a checkout.
 * @returns Trimmed standard output.
 */
function git(args, cwd) {
  // The first stderr line explains a failure.
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git ${args.join(" ")}: ${(result.stderr || "failed").trim().split("\n")[0]}`);
  return result.stdout.trim();
}



/**
 * Finds the checkout that owns the shared git directory.
 *
 * Purpose: Reach the main checkout from any worktree.
 *
 * @param from Folder inside any checkout of the project.
 * @returns Absolute main checkout path.
 */
export function mainCheckout(from = process.cwd()) {
  // Worktrees share one common git directory.
  return path.dirname(gitCommonDir(from));
}



/**
 * Finds the top of the checkout a folder is in.
 *
 * Purpose: Read a worktree's own settings and files.
 *
 * @param from Folder inside a checkout.
 * @returns Absolute checkout root, main or worktree.
 */
export function checkoutRoot(from = process.cwd()) {
  // A worktree answers with itself, not the main checkout.
  return git(["rev-parse", "--show-toplevel"], from);
}



/**
 * Finds the git directory every worktree shares.
 *
 * Purpose: Anchor state that all worktrees see.
 *
 * @param from Folder inside a checkout.
 * @returns Absolute common git directory.
 */
export function gitCommonDir(from = process.cwd()) {
  // Git prints it relative to from.
  return path.resolve(from, git(["rev-parse", "--git-common-dir"], from));
}



/**
 * Finds the folder for activity, usage, and stack records.
 *
 * Purpose: Keep state per project, outside every checkout.
 *
 * @param from Folder inside a checkout.
 * @param env Environment; the server passes its choice down.
 * @returns Absolute state folder; may not exist yet.
 */
export function stateDir(from = process.cwd(), env = process.env) {
  // Sessions inherit the folder; others ask git.
  if (env.COMMAND_CENTER_STATE) return env.COMMAND_CENTER_STATE;
  return path.join(gitCommonDir(from), "command-center");
}



/**
 * Returns where a named worktree lives.
 *
 * Purpose: Keep every agent checkout in one predictable folder.
 *
 * @param name Worktree and branch name.
 * @param from Folder inside any checkout.
 * @returns Absolute path such as ../project-wt/<name>.
 */
export function worktreePath(name, from = process.cwd()) {
  // A sibling folder named after the main checkout.
  const main = mainCheckout(from);
  return path.join(path.dirname(main), `${path.basename(main)}-wt`, name);
}
