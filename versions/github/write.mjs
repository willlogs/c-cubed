// Creates, renames, fills, and closes version milestones.
// Every write goes through gh with the owner's login.

import { gh } from "./gh.mjs";

/** Milestones endpoint; gh fills in the repository. */
const MILESTONES = "repos/{owner}/{repo}/milestones";



/**
 * Creates a version's milestone.
 *
 * Purpose: Define a new version on GitHub.
 *
 * @param repoRoot Main checkout path.
 * @param title Title such as "v2.1.0 — Goal".
 * @param about Why the goal matters, shown on GitHub.
 * @returns The new milestone's number and URL.
 *
 * Side effects: Adds a milestone on GitHub.
 */
export function createMilestone(repoRoot, title, about) {
  // The description holds the goal's why.
  const created = JSON.parse(gh(["api", MILESTONES, "-f", `title=${title}`, "-f", `description=${about}`], repoRoot));
  return { milestone: created.number, url: created.html_url };
}



/**
 * Renames a version's milestone.
 *
 * Purpose: Renumber a version that ships out of order.
 *
 * @param repoRoot Main checkout path.
 * @param milestone Milestone number.
 * @param title New title.
 * @returns No value.
 *
 * Side effects: Renames the milestone on GitHub.
 */
export function renameMilestone(repoRoot, milestone, title) {
  // PATCH keeps its issues and description.
  gh(["api", "-X", "PATCH", `${MILESTONES}/${milestone}`, "-f", `title=${title}`], repoRoot);
}



/**
 * Closes a version's milestone once it is live.
 *
 * Purpose: Mark the version shipped on GitHub.
 *
 * @param repoRoot Main checkout path.
 * @param milestone Milestone number.
 * @returns No value.
 *
 * Side effects: Closes the milestone on GitHub.
 */
export function closeMilestone(repoRoot, milestone) {
  // Closed milestones are what views call live.
  gh(["api", "-X", "PATCH", `${MILESTONES}/${milestone}`, "-f", "state=closed"], repoRoot);
}



/**
 * Puts issues into a version.
 *
 * Purpose: Attach decisions, research, and work to a version.
 *
 * @param repoRoot Main checkout path.
 * @param title The version's milestone title.
 * @param numbers Issue numbers.
 * @returns No value.
 *
 * Side effects: Sets each issue's milestone on GitHub.
 */
export function addIssues(repoRoot, title, numbers) {
  // gh takes the milestone by title.
  for (const number of numbers) gh(["issue", "edit", String(number), "--milestone", title], repoRoot);
}
