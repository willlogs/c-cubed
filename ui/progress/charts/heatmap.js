// Draws the merged-PR heatmap: weeks as columns, Monday first.
// Days before the run are faint, never shown as idle.

import { escapeHtml } from "../../panels.js";

/** Weekday labels, Monday first. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];



/**
 * Formats a day key for people.
 *
 * Purpose: Same short date in every tooltip and label.
 *
 * @param date Day key such as "2026-10-25".
 * @returns Text such as "Sun, Oct 25".
 */
export function dayLabel(date) {
  // Noon avoids timezone shifts.
  return new Date(`${date}T12:00:00`).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}



/**
 * Draws one day's cell.
 *
 * Purpose: Shade by PRs merged; say the count on hover.
 *
 * @param cell Day with merged count, level, and before flag.
 * @returns HTML.
 */
function cellHtml(cell) {
  // Days before the run carry no tooltip.
  if (cell.before) return `<span class="cell before"></span>`;
  const tip = `${dayLabel(cell.date)} · ${cell.merged} PR${cell.merged === 1 ? "" : "s"} merged`;
  return `<span class="cell l${cell.level}" data-tip="${escapeHtml(tip)}"></span>`;
}



/**
 * Draws the heatmap with week labels and a legend.
 *
 * Purpose: Show the rhythm of progress since the run began.
 *
 * @param map Weeks and the busiest count from the server.
 * @returns HTML.
 */
export function heatmapHtml(map) {
  // Each week is headed by its Monday's date.
  const weeks = map.weeks.map((week) => {
    const head = new Date(`${week[0].date}T12:00:00`).toLocaleDateString([], { month: "short", day: "numeric" });
    return `<div class="week"><span class="week-head">${head}</span>${week.map(cellHtml).join("")}</div>`;
  });
  const legend = [0, 1, 2, 3, 4].map((level) => `<span class="cell l${level}"></span>`).join("");
  return `<div class="heatmap"><div class="week weekdays"><span class="week-head"></span>${WEEKDAYS.map((day) => `<span class="weekday">${day}</span>`).join("")}</div>${weeks.join("")}</div>
    <div class="heat-legend">Fewer PRs ${legend} More <span class="hint">· busiest day: ${map.max}</span></div>`;
}
