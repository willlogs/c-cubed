// Draws the headline tiles: PRs merged, decisions, issues closed.
// Totals cover the current run, with today beside them.

/** Tiles: total key, today key, and label. */
const TILES = [["merged", "mergedToday", "PRs merged"], ["decisions", "decisionsToday", "Decisions"], ["closed", null, "Issues closed"]];



/**
 * Draws the headline tiles.
 *
 * Purpose: The run's totals before any chart.
 *
 * @param totals Totals from the server.
 * @param since Label for the run's first day.
 * @returns HTML.
 */
export function tilesHtml(totals, since) {
  // Today's count only where the server gives one.
  return `<div class="trend-tiles">${TILES.map(([key, todayKey, label]) => {
    const today = todayKey ? ` · ${totals[todayKey]} today` : "";
    return `<div class="trend-tile"><div class="value">${totals[key]}</div><div class="label">${label}</div><div class="delta">since ${since}${today}</div></div>`;
  }).join("")}</div>`;
}
