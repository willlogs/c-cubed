// Counts merged PRs, closed issues, and decisions per local day.
// Pure: build.mjs reads GitHub and git, this only sorts.

/** PR types in tooltip order; the rest are other. */
export const TYPES = ["feature", "bug", "chore", "research", "ops", "other"];

/** Days without activity that still count as one run. */
const MAX_GAP_DAYS = 14;



/**
 * Names the local calendar day of a timestamp.
 *
 * Purpose: Group events by the owner's day, not UTC's.
 *
 * @param at ISO timestamp, epoch milliseconds, or a Date.
 * @returns Day key such as "2026-10-25".
 */
export function dayKey(at) {
  // en-CA formats dates as YYYY-MM-DD.
  return new Date(at).toLocaleDateString("en-CA");
}



/**
 * Returns a day's counts, creating them on first use.
 *
 * Purpose: Keep every day in one shape.
 *
 * @param days Map of day key to counts.
 * @param date Day key.
 * @returns The day's counts.
 */
function bucket(days, date) {
  // Types start at zero so tooltips can list them.
  if (!days.has(date)) days.set(date, { date, merged: 0, types: Object.fromEntries(TYPES.map((type) => [type, 0])), closed: 0, decisions: [] });
  return days.get(date);
}



/**
 * Files merges, closes, and decisions under their days.
 *
 * Purpose: Progress is merged PRs; the rest adds context.
 *
 * @param data Issues, merged PRs, and dated decisions.
 * @returns Map of day key to counts.
 */
export function buildDays({ issues, prs, decisions }) {
  // A merge takes the type of the issue it closes.
  const days = new Map();
  const types = new Map(issues.map((issue) => [issue.number, TYPES.find((type) => issue.labels.includes(`type:${type}`)) ?? "other"]));
  for (const pr of prs) {
    const day = bucket(days, dayKey(pr.mergedAt));
    day.merged += 1;
    day.types[types.get(pr.closes[0]) ?? "other"] += 1;
  }

  // Finished issues and recorded decisions.
  for (const issue of issues) if (issue.closedAt && !issue.dropped) bucket(days, dayKey(issue.closedAt)).closed += 1;
  for (const decision of decisions) bucket(days, dayKey(decision.at)).decisions.push(decision);
  return days;
}



/**
 * Finds where the current run of activity began.
 *
 * Purpose: Skip lone old issues; show only the live stretch.
 *
 * @param days Map of day key to counts.
 * @param today Today's day key.
 * @returns First day key of the run, or today.
 */
export function runStart(days, today) {
  // Walk back while gaps stay under two weeks.
  const active = [...days.keys()].filter((date) => date <= today).sort().reverse();
  let start = active[0] ?? today;
  for (const date of active.slice(1)) {
    const gap = (Date.parse(`${start}T12:00:00`) - Date.parse(`${date}T12:00:00`)) / 86_400_000;
    if (gap > MAX_GAP_DAYS) break;
    start = date;
  }
  return start;
}
