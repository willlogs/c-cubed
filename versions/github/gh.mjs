// Runs gh and git for the version flow, failing loudly.
// A silent failure here could fake a release step.

import { spawnSync } from "node:child_process";



/**
 * Runs one command and returns its output, or throws.
 *
 * Purpose: Share error handling between gh and git calls.
 *
 * @param command Executable, gh or git.
 * @param args Arguments after the executable.
 * @param cwd Repository folder.
 * @param input Text for standard input, if any.
 * @returns Trimmed standard output.
 */
function run(command, args, cwd, input) {
  // The first line of stderr says what went wrong.
  const result = spawnSync(command, args, { cwd, input, encoding: "utf8", maxBuffer: 50_000_000 });
  if (result.status !== 0) throw new Error(`${command} ${args.slice(0, 3).join(" ")}: ${(result.stderr || "failed").trim().split("\n")[0]}`);
  return result.stdout.trim();
}



/**
 * Runs gh and returns its output.
 *
 * Purpose: Read and write GitHub with the user's login.
 *
 * @param args Arguments after gh.
 * @param cwd Repository folder.
 * @param input Text for standard input, if any.
 * @returns Trimmed standard output.
 */
export function gh(args, cwd, input) {
  // gh resolves {owner}/{repo} from the checkout.
  return run("gh", args, cwd, input);
}



/**
 * Runs gh and parses its JSON output.
 *
 * Purpose: Read lists of issues, PRs, and milestones.
 *
 * @param args Arguments after gh.
 * @param cwd Repository folder.
 * @returns Parsed JSON value.
 */
export function ghJson(args, cwd) {
  // Empty output means an empty list.
  return JSON.parse(gh(args, cwd) || "[]");
}



/**
 * Finds the root of the checkout a command runs in.
 *
 * Purpose: Read this checkout's files when master lacks them.
 *
 * @param from Folder inside any checkout.
 * @returns Absolute checkout root.
 */
export function checkoutRoot(from = process.cwd()) {
  // Worktrees and the main checkout both answer.
  return run("git", ["rev-parse", "--show-toplevel"], from);
}



/**
 * Runs git and returns its output.
 *
 * Purpose: Read history and write the release commit.
 *
 * @param args Arguments after git.
 * @param cwd Repository or worktree folder.
 * @returns Trimmed standard output.
 */
export function git(args, cwd) {
  // Same failure shape as gh.
  return run("git", args, cwd);
}
