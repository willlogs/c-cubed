// Shapes day counts into the heatmap, day columns, and totals.
// Every view covers the current run of activity only.

import { dayKey } from "./days.mjs";

/** Most day columns shown; the heatmap keeps older days. */
const MAX_COLUMNS = 30;



/**
 * Lists day keys from one day to another.
 *
 * Purpose: Walk calendar days without timezone drift.
 *
 * @param first Oldest day key.
 * @param last Newest day key.
 * @returns Day keys, oldest first.
 */
export function dayRange(first, last) {
  // Noon avoids daylight-saving edges.
  const keys = [];
  for (const day = new Date(`${first}T12:00:00`); dayKey(day) <= last; day.setDate(day.getDate() + 1)) keys.push(dayKey(day));
  return keys;
}



/**
 * Picks the shade level for each count.
 *
 * Purpose: Quartiles keep one burst from washing out the rest.
 *
 * @param counts Counts of every day in view.
 * @returns Function from count to level 0–4.
 */
function leveler(counts) {
  // Zero stays empty; quartile cuts split the rest.
  const active = counts.filter(Boolean).sort((a, b) => a - b);
  const cuts = [0.25, 0.5, 0.75].map((share) => active[Math.floor((active.length - 1) * share)] ?? 0);
  return (count) => (count ? 1 + cuts.filter((value) => count > value).length : 0);
}



/**
 * Builds the heatmap of merged PRs, weeks as columns.
 *
 * Purpose: Show the rhythm of progress since the run began.
 *
 * @param days Map of day key to counts.
 * @param start First day of the run.
 * @param today Today's day key.
 * @returns Monday-first weeks of cells, and the busiest count.
 */
export function heatmap(days, start, today) {
  // Pad back to Monday so rows line up with weekdays.
  const monday = new Date(`${start}T12:00:00`);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const keys = dayRange(dayKey(monday), today);
  const counts = keys.map((key) => (key < start ? 0 : days.get(key)?.merged ?? 0));
  const level = leveler(counts);

  // Seven cells per week; days before the run are blank.
  const cells = keys.map((date, index) => ({ date, merged: counts[index], level: level(counts[index]), before: date < start }));
  const weeks = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return { weeks, max: Math.max(0, ...counts) };
}



/**
 * Builds one column per day for the decision map.
 *
 * Purpose: Decisions and merges share one day axis.
 *
 * @param days Map of day key to counts.
 * @param start First day of the run.
 * @param today Today's day key.
 * @returns At most thirty days, oldest first.
 */
export function columns(days, start, today) {
  // Quiet days keep their column so gaps show.
  return dayRange(start, today).slice(-MAX_COLUMNS).map((date) => days.get(date) ?? { date, merged: 0, types: {}, closed: 0, decisions: [] });
}



/**
 * Totals the run and today.
 *
 * Purpose: Headline numbers above the charts.
 *
 * @param days Map of day key to counts.
 * @param start First day of the run.
 * @param today Today's day key.
 * @returns Merged, closed, decisions, and today's merges.
 */
export function totals(days, start, today) {
  // Only days inside the run count.
  const run = { merged: 0, closed: 0, decisions: 0 };
  for (const day of days.values()) {
    if (day.date < start || day.date > today) continue;
    Object.assign(run, { merged: run.merged + day.merged, closed: run.closed + day.closed, decisions: run.decisions + day.decisions.length });
  }
  return {
    ...run, mergedToday: days.get(today)?.merged ?? 0, decisionsToday: days.get(today)?.decisions.length ?? 0,
  };
}
