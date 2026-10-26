// Moves one finished version forward a single release step.
// Each run reads GitHub fresh, so repeating it is safe.

import { readCurrent } from "../files.mjs";
import { git } from "../github/gh.mjs";
import { readGitHub } from "../github/read.mjs";
import { renameMilestone } from "../github/write.mjs";
import { describeAll, findVersion, forgetVersions } from "../list.mjs";
import { bumpNumber, bumpOf, compareNumbers, formatTitle } from "../model/number.mjs";
import { openPromotion } from "./promote.mjs";
import { publishVersion } from "./publish.mjs";
import { openRelease } from "./release.mjs";

/** Stages where a version's release has started. */
const SHIPPING = ["releasing", "promoting", "publishing"];



/**
 * Lists a version's open issues for a refusal.
 *
 * Purpose: Say exactly what blocks shipping.
 *
 * @param version Described version.
 * @returns One line per open issue.
 */
function openIssues(version) {
  // Group names read as reasons.
  return Object.entries(version.groups).flatMap(([group, items]) =>
    items.filter((item) => item.open).map((item) => `  #${item.number} ${item.title} (${group})`));
}



/**
 * Gives a version the next free number when it lags.
 *
 * Purpose: Ship out of order without going backwards.
 *
 * @param repoRoot Main checkout path.
 * @param version Version about to be released.
 * @param dryRun Whether to only report the rename.
 * @returns The version, renumbered if needed.
 *
 * Side effects: May rename the milestone.
 */
function renumber(repoRoot, version, dryRun) {
  // Keep its kind: a planned major stays a major.
  const current = readCurrent(repoRoot);
  if (compareNumbers(version.number, current) > 0) return version;
  const number = bumpNumber(current, bumpOf(version.number));
  const title = formatTitle(number, version.goal);
  if (!dryRun) renameMilestone(repoRoot, version.milestone, title);
  console.log(`v${version.number} is not past ${current}; ${dryRun ? "would rename" : "renamed"} it to ${title}.`);
  return { ...version, number, title };
}



/**
 * Runs the next release step for one version.
 *
 * Purpose: One command walks a version from ready to live.
 *
 * @param repoRoot Main checkout path.
 * @param ref Version number, or #milestone.
 * @param dryRun Whether to only print the next step.
 * @returns Exit code and text to print.
 *
 * Side effects: May push, open PRs, tag, and close milestones.
 */
export function shipVersion(repoRoot, ref, dryRun) {
  // Fresh refs and fresh GitHub state, every run.
  git(["fetch", "--quiet", "origin"], repoRoot);
  const data = readGitHub(repoRoot);
  const versions = describeAll(data);
  const version = findVersion(versions, ref);
  forgetVersions();

  // Unfinished versions and waiting steps only report.
  if (version.stage === "live") return { code: 0, text: `v${version.number} is already live.` };
  if (!["ready", ...SHIPPING].includes(version.stage)) {
    return { code: 1, text: `v${version.number} is not finished:\n${openIssues(version).join("\n") || "  it has no issues yet."}` };
  }
  if (version.stage === "promoting" || version.release?.state === "OPEN") return { code: 0, text: version.next };

  // One release at a time, so promotions never overlap.
  const busy = versions.find((item) => item !== version && SHIPPING.includes(item.stage));
  if (version.stage === "ready" && busy) return { code: 1, text: `Finish shipping v${busy.number} first: ${busy.next}` };

  // Release PR, then promotion PR, then publish.
  if (version.stage === "ready") return { code: 0, text: openRelease(repoRoot, renumber(repoRoot, version, dryRun), data, dryRun) };
  if (version.stage === "releasing") return { code: 0, text: openPromotion(repoRoot, version, dryRun) };
  // Without production, a merged release publishes next.
  return { code: 0, text: publishVersion(repoRoot, version, dryRun) };
}
