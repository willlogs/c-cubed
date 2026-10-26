// Opens a version's release PR: the bump and its changelog.
// It merges into the trunk like any PR, after verify.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import { loadConfig } from "../../config/load.mjs";
import { worktreePath } from "../../config/paths.mjs";
import { changelogSection } from "../changelog/section.mjs";
import { versionFiles, writeRelease } from "../files.mjs";
import { gh, git } from "../github/gh.mjs";
import { releaseBranch } from "../github/read.mjs";
import { toItem } from "../model/groups.mjs";

/** Reusable worktree for release commits, beside verify-pr. */
const WORKTREE = "version-release";

/** PR numbers in squash and merge commit subjects. */
const SUBJECT_PR = /\(#(\d+)\)\s*$|^Merge pull request #(\d+)/;



/**
 * Turns one loose merged PR into a changelog item.
 *
 * Purpose: Give it its closing issue's priority and type.
 *
 * @param number PR number from a commit subject.
 * @param data Raw issues and PRs from readGitHub.
 * @returns A one-item list, or none for release PRs.
 */
function looseItem(number, data) {
  // Release commits are the trail itself, not changes.
  const pr = data.prs.find((item) => item.number === number);
  if (!pr || pr.headRefName.startsWith("release-v")) return [];
  const issue = data.issues.find((item) => pr.closingIssuesReferences?.some((ref) => ref.number === item.number));
  const item = issue ? toItem({ ...issue, labels: issue.labels.map((label) => label.name) }) : null;
  return [{ number: issue?.number ?? null, title: pr.title, type: item?.type ?? null, priority: item?.priority ?? null, prs: [number] }];
}



/**
 * Lists PRs merged since production that are outside the version.
 *
 * Purpose: Versions ship all of trunk; the trail names everything.
 *
 * @param repoRoot Main checkout path.
 * @param version Version being released.
 * @param data Raw issues and PRs from readGitHub.
 * @returns Changelog items for the "Also shipped" list.
 */
function alsoShipped(repoRoot, version, data) {
  // Commit subjects name each merged PR.
  const log = git(["log", "--format=%s", "--max-count=1000", shippedRange(repoRoot)], repoRoot).split("\n");
  const merged = log.map((subject) => SUBJECT_PR.exec(subject)).filter(Boolean).map((match) => Number(match[1] ?? match[2]));
  const planned = new Set(Object.values(version.groups).flat().flatMap((item) => item.prs));

  // Each loose PR takes its issue's priority and type.
  return merged.filter((number) => !planned.has(number)).flatMap((number) => looseItem(number, data));
}



/**
 * Names the commits this release ships.
 *
 * Purpose: Since production, else since the last tag.
 *
 * @param repoRoot Main checkout path.
 * @returns A git revision range or ref.
 */
function shippedRange(repoRoot) {
  // Without production, the newest tag marks the last release.
  const { trunk, production } = loadConfig(repoRoot).branches;
  if (production) return `origin/${production}..origin/${trunk}`;
  const tag = spawnSync("git", ["describe", "--tags", "--abbrev=0", `origin/${trunk}`], { cwd: repoRoot, encoding: "utf8" });
  return tag.status === 0 ? `${tag.stdout.trim()}..origin/${trunk}` : `origin/${trunk}`;
}



/**
 * Returns the release worktree, creating it on first use.
 *
 * Purpose: Write the release commit without touching any checkout.
 *
 * @param repoRoot Main checkout path.
 * @returns Absolute worktree path.
 *
 * Side effects: May add a detached git worktree.
 */
function ensureWorktree(repoRoot) {
  // Detached at the trunk; the branch is made per release.
  const dir = worktreePath(WORKTREE);
  if (!fs.existsSync(dir)) git(["worktree", "add", "--detach", dir, `origin/${loadConfig(repoRoot).branches.trunk}`], repoRoot);
  return dir;
}



/**
 * Writes the release PR's description.
 *
 * Purpose: Tell the master what merging it does next.
 *
 * @param version Version being released.
 * @param section Its changelog section.
 * @param files Version file and changelog paths.
 * @returns Markdown body.
 */
function releaseBody(version, section, files) {
  // The section itself is the review material.
  return [
    `Release commit for **${version.title}**.`, "",
    `- Sets the version to \`${version.number}\` in \`${files.file}\`.`,
    `- Adds the v${version.number} section to \`${files.changelog}\`.`, "",
    `Verify and merge it like any PR, then run \`npm run cc -- version ship v${version.number}\` for the next step.`,
    "", "---", "", section,
  ].join("\n");
}



/**
 * Opens a version's release PR into the trunk.
 *
 * Purpose: First release step once every issue is closed.
 *
 * @param repoRoot Main checkout path, freshly fetched.
 * @param version Described version, ready to ship.
 * @param data Raw issues and PRs from readGitHub.
 * @param dryRun Whether to only print the plan.
 * @returns Text to print.
 *
 * Side effects: Commits, pushes a branch, opens a PR.
 */
export function openRelease(repoRoot, version, data, dryRun) {
  // The section is dated the day the release is cut.
  const section = changelogSection(version, new Date().toLocaleDateString("en-CA"), alsoShipped(repoRoot, version, data));
  const branch = releaseBranch(version.number);
  const title = `Release ${version.title}`;
  const files = versionFiles(repoRoot);
  if (dryRun) return `Would open "${title}" from ${branch} into ${files.trunk} with:\n\n${section}`;

  // Branch from the trunk, write both files, push.
  const dir = ensureWorktree(repoRoot);
  git(["checkout", "--force", "-B", branch, `origin/${files.trunk}`], dir);
  git(["add", ...writeRelease(dir, version.number, section)], dir);
  git(["commit", "-m", `Release v${version.number}: ${version.goal}`], dir);
  git(["push", "--force-with-lease", "-u", "origin", branch], dir);

  // Open the PR in the version's milestone.
  const args = ["pr", "create", "--base", files.trunk, "--head", branch, "--title", title, "--milestone", version.title, "--body-file", "-"];
  const url = gh(args, repoRoot, releaseBody(version, section, files));
  return `Opened release PR ${url}\nVerify and merge it, then run: npm run cc -- version ship v${version.number}`;
}
