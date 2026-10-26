// Opens a version's promotion PR into production for the owner.
// It ships a branch frozen at the release commit.

import path from "node:path";
import { loadConfig } from "../../config/load.mjs";
import { findSection } from "../changelog/section.mjs";
import { readChangelog } from "../files.mjs";
import { gh, git } from "../github/gh.mjs";
import { shipBranch } from "../github/read.mjs";



/**
 * Lists migrations the promotion would add to production.
 *
 * Purpose: Promotion PRs list every new migration.
 *
 * @param repoRoot Main checkout path.
 * @param sha Release commit being promoted.
 * @returns Migration folders, oldest first; none when unset.
 */
function newMigrations(repoRoot, sha) {
  // Projects name their migration files, if any.
  const { versions, branches } = loadConfig(repoRoot);
  if (!versions.migrations) return [];
  const files = git(["diff", "--name-only", "--diff-filter=A", `origin/${branches.production}`, sha, "--", `:(glob)${versions.migrations}`], repoRoot);
  return files.split("\n").filter(Boolean).map((file) => path.dirname(file)).sort();
}



/**
 * Writes the promotion PR's description.
 *
 * Purpose: Tell the owner how to merge and what ships.
 *
 * @param version Version being promoted.
 * @param sha Release commit on the trunk.
 * @param migrations New migration folders.
 * @param section Its changelog section.
 * @returns Markdown body.
 */
function promotionBody(version, sha, migrations, section) {
  // How to merge comes before what ships.
  const listed = migrations.length ? migrations.map((folder) => `- \`${folder}\``) : ["None."];
  return [
    `Ships **${version.title}** to production. Versions are what ship; the owner merges this PR.`, "",
    `- \`${shipBranch(version.number)}\` is frozen at release commit \`${sha.slice(0, 9)}\` from #${version.release.number}, so later trunk merges stay out.`,
    "- **Merge with \"Create a merge commit\"**, never squash or rebase, so production stays an ancestor of the trunk.",
    `- After the merge, the master runs \`npm run cc -- version ship v${version.number}\` to tag it, publish the GitHub Release, and close the milestone.`,
    "", "### New migrations", "", ...listed, "", "### Changelog", "", section,
  ].join("\n");
}



/**
 * Opens a version's promotion PR into production.
 *
 * Purpose: Second release step, after the release PR merges.
 *
 * @param repoRoot Main checkout path, freshly fetched.
 * @param version Version whose release PR merged.
 * @param dryRun Whether to only print the plan.
 * @returns Text to print.
 *
 * Side effects: Pushes the ship branch and opens a PR.
 */
export function openPromotion(repoRoot, version, dryRun) {
  // The changelog on the trunk is the reviewed text.
  const sha = version.release.mergeCommit;
  const section = findSection(readChangelog(repoRoot), version.number);
  if (!section) throw new Error(`The trunk's changelog has no v${version.number} section. Is #${version.release.number} merged and fetched?`);
  const body = promotionBody(version, sha, newMigrations(repoRoot, sha), section);
  const branch = shipBranch(version.number);
  if (dryRun) return `Would push ${branch} at ${sha.slice(0, 9)} and open a PR into production with:\n\n${body}`;

  // Freeze the branch, then ask the owner to merge.
  git(["push", "origin", `${sha}:refs/heads/${branch}`], repoRoot);
  const args = ["pr", "create", "--base", loadConfig(repoRoot).branches.production, "--head", branch, "--title", `Ship ${version.title}`,
    "--milestone", version.title, "--label", "needs-human-review", "--body-file", "-"];
  const url = gh(args, repoRoot, body);
  return `Opened promotion PR ${url}\nWill merges it with a merge commit; then run: npm run cc -- version ship v${version.number}`;
}
