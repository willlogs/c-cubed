// Formats versions as plain text for the cc CLI.
// Same facts as the Versions tab, one line per idea.

/** Marks for track steps: done, active, to do. */
const MARKS = { done: "✓", active: "●", todo: "○" };



/**
 * Writes a version's track on one line.
 *
 * Purpose: Show decide → live progress in a terminal.
 *
 * @param track Steps from trackOf.
 * @returns Text such as "✓ Decide 2/2 → ● Build 1/3".
 */
export function trackText(track) {
  // Skipped steps drop out; issue steps show counts.
  return track.filter((step) => step.state !== "skip")
    .map((step) => `${MARKS[step.state]} ${step.label}${step.total ? ` ${step.done}/${step.total}` : ""}`).join(" → ");
}



/**
 * Writes the version list.
 *
 * Purpose: Answer "which versions are open, and where?".
 *
 * @param views Payload from listVersions.
 * @returns Printable text.
 */
export function listText(views) {
  // Current first, then open versions, then shipped ones.
  const lines = [`Current version: ${views.current}`, "", "Open versions (next to ship first):"];
  if (!views.open.length) lines.push("  none. Define one: npm run cc -- version new \"<goal>\"");
  for (const version of views.open) {
    lines.push(`  ${version.title}  [${version.stageLabel}]`, `    ${trackText(version.track)}`, `    Next: ${version.next}`, `    ${version.url}`);
  }
  lines.push("", "Shipped:", ...(views.shipped.length ? views.shipped.map((version) => `  ${version.title}  ${version.next}`) : ["  none yet."]));
  return lines.join("\n");
}



/**
 * Writes one issue as a list line.
 *
 * Purpose: Show state, priority, type, and merged PRs.
 *
 * @param item Item from groupIssues.
 * @returns Line such as "○ #85 P0 feature Title (PR #120)".
 */
function itemLine(item) {
  // ○ open, ✓ closed; empty labels collapse away.
  const prs = item.prs.length ? ` (PR ${item.prs.map((pr) => `#${pr}`).join(", ")})` : "";
  const tags = [item.priority, item.type].filter(Boolean).join(" ");
  return `  ${item.open ? "○" : "✓"} #${item.number} ${tags ? `${tags} ` : ""}${item.title}${prs}`;
}



/**
 * Writes one group of a version's issues.
 *
 * Purpose: List each issue with state, priority, and PRs.
 *
 * @param name Group heading.
 * @param items Items of one group.
 * @returns Lines, or none for an empty group.
 */
function groupLines(name, items) {
  // Empty groups print nothing.
  return items.length ? [`${name}:`, ...items.map(itemLine)] : [];
}



/**
 * Writes one release PR's state and link.
 *
 * Purpose: Same line for the release and promotion PRs.
 *
 * @param pr PR with number, state, and url, or null.
 * @returns Text such as "#9 merged https://…".
 */
function prText(pr) {
  // Not opened yet until its step runs.
  return pr ? `#${pr.number} ${pr.state.toLowerCase()} ${pr.url}` : "none yet";
}



/**
 * Writes one version in full.
 *
 * Purpose: Show everything a version holds and what is next.
 *
 * @param version Described version.
 * @returns Printable text.
 */
export function showText(version) {
  // Head, groups, then release PRs.
  return [
    `${version.title}  [${version.stageLabel}]`, version.url, ...(version.about ? ["", version.about.trim()] : []), "",
    `Track: ${trackText(version.track)}`, `Next: ${version.next}`, "",
    ...groupLines("Decisions", version.groups.decisions), ...groupLines("Research", version.groups.research), ...groupLines("Work", version.groups.work),
    "", `Release PR: ${prText(version.release)}`, `Promotion PR: ${prText(version.promotion)}`,
  ].join("\n");
}
