// Tags a live version, publishes its release, closes its milestone.
// The tag marks what shipped: promotion or release merge.

import { findSection } from "../changelog/section.mjs";
import { readChangelog } from "../files.mjs";
import { gh } from "../github/gh.mjs";
import { closeMilestone } from "../github/write.mjs";



/**
 * Tells whether a GitHub Release already exists.
 *
 * Purpose: Let a rerun finish a half-done publish.
 *
 * @param repoRoot Main checkout path.
 * @param tag Tag such as "v2.1.0".
 * @returns True when the release exists.
 */
function releaseExists(repoRoot, tag) {
  // gh fails when the release is missing.
  try {
    gh(["release", "view", tag, "--json", "tagName"], repoRoot);
    return true;
  } catch {
    return false;
  }
}



/**
 * Publishes a version whose promotion merged.
 *
 * Purpose: Last release step: tag, release notes, closed milestone.
 *
 * @param repoRoot Main checkout path, freshly fetched.
 * @param version Version whose promotion PR merged.
 * @param dryRun Whether to only print the plan.
 * @returns Text to print.
 *
 * Side effects: Creates a tag and release; closes the milestone.
 */
export function publishVersion(repoRoot, version, dryRun) {
  // Notes are the committed changelog section.
  const tag = `v${version.number}`;
  const sha = (version.promotion ?? version.release).mergeCommit;
  const notes = findSection(readChangelog(repoRoot), version.number) || `${version.title}\n`;
  if (dryRun) return `Would tag ${tag} at ${sha.slice(0, 9)}, publish its release, and close the milestone. Notes:\n\n${notes}`;

  // gh creates the tag on GitHub at the merge commit.
  if (!releaseExists(repoRoot, tag)) gh(["release", "create", tag, "--target", sha, "--title", version.title, "--notes-file", "-"], repoRoot, notes);
  closeMilestone(repoRoot, version.milestone);
  return `${tag} is live: ${version.title}. Tagged ${sha.slice(0, 9)}, released, and closed the milestone.`;
}
