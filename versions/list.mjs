// Builds the version views the tab, CLI, and status share.
// Open versions come next-to-ship first; shipped ones newest first.

import { findSection } from "./changelog/section.mjs";
import { readChangelog, readCurrent } from "./files.mjs";
import { readGitHub, toVersions } from "./github/read.mjs";
import { groupIssues } from "./model/groups.mjs";
import { compareNumbers } from "./model/number.mjs";
import { STAGE_LABELS, nextStep, stageOf, trackOf } from "./model/stage.mjs";

/** Rebuild at most once a minute; GitHub calls are slow. */
const CACHE_MS = 60_000;

/** Last built views and when they were built. */
let cache = { at: 0, value: null };



/**
 * Adds groups, stage, track, and next step to a version.
 *
 * Purpose: Derive every view field in one place.
 *
 * @param version Version from toVersions.
 * @returns The version with its derived fields.
 */
export function describeVersion(version) {
  // Stage needs groups; track and next need stage.
  const grouped = { ...version, groups: groupIssues(version.issues) };
  const stage = stageOf(grouped);
  const staged = { ...grouped, stage, stageLabel: STAGE_LABELS[stage] };
  return { ...staged, track: trackOf(staged), next: nextStep(staged) };
}



/**
 * Reads every version, described and sorted.
 *
 * Purpose: Answer the Versions tab and the CLI's list.
 *
 * @param repoRoot Main checkout path.
 * @param fresh Whether to skip the cache.
 * @returns Current version, open and shipped versions, build time.
 */
export function listVersions(repoRoot, fresh = false) {
  // Serve the cache while it is fresh.
  if (!fresh && cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
  const versions = describeAll(readGitHub(repoRoot));
  const changelog = readChangelog(repoRoot);

  // Drop issue bodies; views never show them.
  const slim = versions.map(({ issues, ...version }) => ({ ...version, notes: version.open ? "" : findSection(changelog, version.number) }));
  const value = {
    current: readCurrent(repoRoot), builtAt: new Date().toISOString(),
    open: slim.filter((version) => version.open).sort((a, b) => compareNumbers(a.number, b.number)),
    shipped: slim.filter((version) => !version.open).sort((a, b) => compareNumbers(b.number, a.number)),
  };
  cache = { at: Date.now(), value };
  return value;
}



/**
 * Describes every version in one GitHub read.
 *
 * Purpose: Commands need issues, which the cached views drop.
 *
 * @param data Milestones, issues, and PRs from readGitHub.
 * @returns Described versions, issues included.
 */
export function describeAll(data) {
  // Same derivation the views use.
  return toVersions(data).map(describeVersion);
}



/**
 * Finds one version by number or milestone.
 *
 * Purpose: Accept a number, with or without "v", or #milestone.
 *
 * @param versions Described versions.
 * @param ref Version number or milestone number.
 * @returns The matching version.
 */
export function findVersion(versions, ref) {
  // Numbers first; "#7" names a milestone.
  const wanted = String(ref ?? "").replace(/^v/, "");
  const milestone = wanted.startsWith("#") ? Number(wanted.slice(1)) : null;
  const version = versions.find((item) => item.number === wanted || item.milestone === milestone);
  if (!version) throw new Error(`No version ${ref}. See: npm run cc -- version`);
  return version;
}



/**
 * Forgets the cached views.
 *
 * Purpose: Show a change made from the page at once.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
export function forgetVersions() {
  // The next list call reads GitHub again.
  cache = { at: 0, value: null };
}
