// Enforces the merge and branch rules for every Claude session.
// Merges need a passing local verify; protected branches refuse pushes.

import { spawnSync } from "node:child_process";

/** Commit status context that cc verify writes. */
export const VERIFY_CONTEXT = "local verify";



/**
 * Splits a shell command into its simple commands.
 *
 * Purpose: Judge each command of a chain separately.
 *
 * @param command Full Bash command text.
 * @returns Word lists, one per simple command.
 */
export function simpleCommands(command) {
  // Quotes are dropped; chains split on ; && || and |.
  return String(command).split(/;|&&|\|\||\||\n/).map((part) => part.replace(/["']/g, "").trim().split(/\s+/).filter(Boolean)).filter((words) => words.length);
}



/**
 * Finds a forced push, or one to a protected branch.
 *
 * Purpose: Branches change only through reviewed merges.
 *
 * @param words One simple command's words.
 * @param protectedNames Trunk, staging, and production names.
 * @param currentBranch Reads the branch a bare push sends.
 * @returns Reason to block, or null.
 */
export function pushReason(words, protectedNames, currentBranch) {
  // Only git push commands matter here.
  const at = words.indexOf("push");
  if (words[0] !== "git" || at < 0) return null;
  const rest = words.slice(at + 1);
  if (rest.some((word) => word === "--force" || word === "-f" || /^\+/.test(word))) return "force pushes rewrite shared history.";

  // Each refspec's destination is after its colon.
  const targets = rest.filter((word) => !word.startsWith("-")).slice(1).map((spec) => spec.split(":").at(-1).replace(/^refs\/heads\//, ""));
  if (!targets.length) targets.push(currentBranch());
  const hit = targets.find((name) => protectedNames.includes(name));
  return hit ? `${hit} changes only through merged pull requests, never a direct push.` : null;
}



/**
 * Finds a merge that lacks a passing local verify.
 *
 * Purpose: The master merges only verified heads.
 *
 * @param words One simple command's words.
 * @param production Production branch name, or null.
 * @param lookup Reads a PR's base and head verify state.
 * @returns Reason to block, or null.
 */
export function mergeReason(words, production, lookup) {
  // Only gh pr merge commands matter here.
  if (words[0] !== "gh" || words[1] !== "pr" || words[2] !== "merge") return null;
  const number = words.slice(3).find((word) => /^\d+$/.test(word));
  if (!number) return "name the pull request number, so the verified head is the one merged.";

  // Production merges are the owner's; others need verify.
  const pr = lookup(number);
  if (!pr) return `GitHub did not answer for #${number}; cannot confirm its local verify.`;
  if (production && pr.base === production) return `only the owner merges into ${production}.`;
  if (pr.verify !== "success") return `#${number} head ${pr.head.slice(0, 7)} has no passing local verify; run npm run cc -- verify ${number} first.`;
  return null;
}



/**
 * Reads a PR's base, head, and the head's verify state.
 *
 * Purpose: The real lookup behind mergeReason.
 *
 * @param number Pull request number.
 * @param cwd Folder inside the repository.
 * @returns Base, head, and verify state; null on failure.
 */
export function lookupPullRequest(number, cwd) {
  // Two gh calls: the PR, then its head's statuses.
  const view = spawnSync("gh", ["pr", "view", number, "--json", "headRefOid,baseRefName"], { cwd, encoding: "utf8" });
  if (view.status !== 0) return null;
  const { headRefOid, baseRefName } = JSON.parse(view.stdout);
  const query = `.statuses[] | select(.context == "${VERIFY_CONTEXT}") | .state`;
  const status = spawnSync("gh", ["api", `repos/{owner}/{repo}/commits/${headRefOid}/status`, "--jq", query], { cwd, encoding: "utf8" });
  return { base: baseRefName, head: headRefOid, verify: status.status === 0 ? status.stdout.trim().split("\n")[0] : "" };
}



/**
 * Checks a command against the merge and branch rules.
 *
 * Purpose: One entry point for the guard hook.
 *
 * @param command Full Bash command text.
 * @param branches Trunk, staging, and production names.
 * @param cwd Folder the command runs in.
 * @param fakes lookup and currentBranch; tests pass fakes.
 * @returns Reason to block, or null.
 */
export function policyReason(command, branches, cwd, fakes = {}) {
  // Real lookups unless a test passes fakes.
  const lookup = fakes.lookup ?? ((number) => lookupPullRequest(number, cwd));
  const current = fakes.currentBranch ?? (() => spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd, encoding: "utf8" }).stdout?.trim() ?? "");
  const protectedNames = [branches.trunk, branches.staging, branches.production].filter(Boolean);

  // The first rule a simple command breaks wins.
  for (const words of simpleCommands(command)) {
    const reason = pushReason(words, protectedNames, current) ?? mergeReason(words, branches.production, lookup);
    if (reason) return reason;
  }
  return null;
}
