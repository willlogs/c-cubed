// Works out where a version stands, from GitHub alone.
// Decide → Research → Build → Release → Live, with no bookkeeping.

/** Stage names as views show them. */
export const STAGE_LABELS = {
  planning: "Planning", deciding: "Deciding", researching: "Researching", building: "Building",
  ready: "Ready to ship", releasing: "Releasing", promoting: "Waiting for the owner", publishing: "Publishing", live: "Live",
};



/**
 * Builds one issue step of the track.
 *
 * Purpose: Count a group's closed issues and name its state.
 *
 * @param label Step name, such as "Decide".
 * @param items Items of one group.
 * @param required Whether an empty group is still to do.
 * @returns Label, done and total counts, and state.
 */
function issueStep(label, items, required) {
  // Closed means decided, reported, or merged.
  const done = items.filter((item) => !item.open).length;
  const total = items.length;
  const state = !total ? (required ? "todo" : "skip") : done === total ? "done" : "active";
  return { label, done, total, state };
}



/**
 * Names a version's current stage.
 *
 * Purpose: Show the earliest unfinished step first.
 *
 * @param version Version with groups and release PRs.
 * @returns A STAGE_LABELS key.
 */
export function stageOf(version) {
  // Release steps win once they have started.
  const { groups, release, promotion } = version;
  if (!version.open) return "live";
  if (promotion?.state === "MERGED") return "publishing";
  if (promotion?.state === "OPEN") return "promoting";
  if (release?.state === "MERGED" && version.promotes === false) return "publishing";
  if (release) return "releasing";

  // Otherwise the earliest group with open issues.
  const all = [...groups.decisions, ...groups.research, ...groups.work];
  if (!all.length) return "planning";
  if (groups.decisions.some((item) => item.open)) return "deciding";
  if (groups.research.some((item) => item.open)) return "researching";
  return groups.work.some((item) => item.open) ? "building" : "ready";
}



/**
 * Builds the five-step track a version card draws.
 *
 * Purpose: Show progress from decide through live.
 *
 * @param version Version with groups, release PRs, and stage.
 * @returns Steps with label, counts, and state.
 */
export function trackOf(version) {
  // Empty decision and research steps are skipped.
  const { stage, release } = version;
  const shipping = ["promoting", "publishing"].includes(stage);
  const releaseState = release?.state === "MERGED" ? "done" : release || stage === "ready" ? "active" : "todo";
  return [
    issueStep("Decide", version.groups.decisions, false),
    issueStep("Research", version.groups.research, false),
    issueStep("Build", version.groups.work, true),
    { label: "Release", state: stage === "live" || shipping ? "done" : releaseState },
    { label: "Live", state: stage === "live" ? "done" : shipping ? "active" : "todo" },
  ];
}



/**
 * Counts a group's open issues.
 *
 * Purpose: Say how much is left in a step.
 *
 * @param items Items of one group.
 * @returns Number of open items.
 */
function openCount(items) {
  // Open means not yet decided, reported, or merged.
  return items.filter((item) => item.open).length;
}



/**
 * Says what moves a version forward next.
 *
 * Purpose: One line for cards, the CLI, and the master.
 *
 * @param version Version with number, stage, groups, and PRs.
 * @returns Plain-text next step.
 */
export function nextStep(version) {
  // Open issues first, then each release step.
  const ship = `npm run cc -- version ship v${version.number}`;
  const { groups, release, promotion } = version;
  const steps = {
    planning: "Add its decisions, research, and work issues to the milestone.",
    deciding: `${openCount(groups.decisions)} decision(s) wait for the owner.`,
    researching: `${openCount(groups.research)} research issue(s) still open.`,
    building: `${openCount(groups.work)} work issue(s) still open.`,
    ready: `Every issue is closed. Run ${ship} to open the release PR.`,
    releasing: release?.state === "OPEN" ? `Verify and merge release PR #${release.number}, then run ${ship}.` : `Run ${ship} to open the promotion PR.`,
    promoting: `The owner merges promotion PR #${promotion?.number} with a merge commit.`,
    publishing: `Run ${ship} to tag v${version.number} and publish its release.`,
    live: `Live${version.closedAt ? ` since ${version.closedAt.slice(0, 10)}` : ""}.`,
  };
  return steps[version.stage];
}
