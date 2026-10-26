// Reads open PRs, open issues, issue branches, and worktrees.
// GitHub answers are cached briefly; git answers are always live.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parseWorktrees } from "../../../instances/worktree/git.mjs";

/** Runs a command without blocking the server's event loop. */
const run = promisify(execFile);

/** Reuse GitHub answers this long; Status polls often. */
const CACHE_MS = 30_000;

/** Fields the PR rows need, including files for previews. */
const PR_FIELDS = "number,title,url,headRefName,isDraft,mergeable,files";

/** Last GitHub answer and when it arrived. */
let cache = { at: 0, github: null };



/**
 * Reads everything the Status rows are built from.
 *
 * Purpose: Feed buildTargets one consistent snapshot.
 *
 * @param repoRoot Main checkout path.
 * @param fresh Whether to skip the GitHub cache.
 * @returns PRs, issues, branches, worktrees, and GitHub freshness.
 */
export async function readSources(repoRoot, fresh = false) {
  // GitHub and git run side by side.
  const [github, branches, worktrees] = await Promise.all([readGithub(repoRoot, fresh), readBranches(repoRoot), readWorktrees(repoRoot)]);
  return { prs: github.prs, issues: github.issues, branches, worktrees, github: { at: github.at, error: github.error } };
}



/**
 * Reads open PRs and issues through gh, cached briefly.
 *
 * Purpose: Keep polling cheap and survive a missing login.
 *
 * @param repoRoot Main checkout path.
 * @param fresh Whether to skip the cache.
 * @returns PRs, issues, fetch time, and any error.
 */
async function readGithub(repoRoot, fresh) {
  // Serve the cache while it is fresh.
  if (!fresh && cache.github && Date.now() - cache.at < CACHE_MS) return cache.github;
  try {
    const [prs, issues] = await Promise.all([
      readJson(["pr", "list", "--state", "open", "--limit", "100", "--json", PR_FIELDS], repoRoot),
      readJson(["issue", "list", "--state", "open", "--limit", "300", "--json", "number,title,url,labels"], repoRoot),
    ]);
    cache = { at: Date.now(), github: { prs, issues, at: new Date().toISOString(), error: null } };
    return cache.github;
  } catch (error) {
    // Failures are not cached, so the next poll retries.
    return { prs: [], issues: [], at: null, error: `GitHub unavailable: ${error.message.split("\n")[0]}` };
  }
}



/**
 * Runs gh and parses its JSON output.
 *
 * Purpose: Share one way to call GitHub.
 *
 * @param args Arguments after gh.
 * @param cwd Repository folder.
 * @returns Parsed JSON.
 */
async function readJson(args, cwd) {
  // Large PRs list many files; allow a big buffer.
  const { stdout } = await run("gh", args, { cwd, maxBuffer: 20_000_000 });
  return JSON.parse(stdout || "[]");
}



/**
 * Lists local and origin issue branches by name.
 *
 * Purpose: Find open issues that already have work.
 *
 * @param repoRoot Main checkout path.
 * @returns Branch names without ref prefixes, possibly repeated.
 */
async function readBranches(repoRoot) {
  // Workers' unpushed branches exist only locally.
  const args = ["for-each-ref", "--format=%(refname)", "refs/heads/issue-*", "refs/remotes/origin/issue-*"];
  const { stdout } = await run("git", args, { cwd: repoRoot });
  return stdout.split("\n").filter(Boolean).map((ref) => ref.replace(/^refs\/(heads|remotes\/origin)\//, ""));
}



/**
 * Lists worktrees with their checked-out branch.
 *
 * Purpose: Show which branch rows already have a checkout.
 *
 * @param repoRoot Main checkout path.
 * @returns Worktrees from the launcher's porcelain parser.
 */
async function readWorktrees(repoRoot) {
  // Same parser the instances CLI uses.
  const { stdout } = await run("git", ["worktree", "list", "--porcelain"], { cwd: repoRoot });
  return parseWorktrees(stdout);
}
