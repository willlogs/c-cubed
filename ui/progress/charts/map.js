// Draws the day map: decision bubbles over merged-PR bars.
// Bubble area is importance; bars are progress, one per day.

import { escapeHtml } from "../../panels.js";
import { bandHeight, packBand } from "./pack.js";
import { dayLabel } from "./heatmap.js";

/** Heights of the PR lane, lane titles, and day labels. */
const LAYOUT = { title: 20, bars: 110, axis: 34 };

/** PR types in tooltip order. */
const TYPES = ["feature", "bug", "chore", "research", "ops", "other"];



/**
 * Turns a day's decisions into sized bubbles.
 *
 * Purpose: Bigger decisions draw bigger; minor ones small.
 *
 * @param decisions The day's decisions.
 * @param scale Largest importance and radius range.
 * @returns Bubbles, biggest first.
 */
function bubblesOf(decisions, scale) {
  // Rings add room for decisions that change earlier ones.
  return decisions.map((decision) => {
    // A steep curve: major decisions dwarf minor ones.
    const share = (decision.importance / scale.max) ** 0.7;
    const r = scale.min + (scale.top - scale.min) * share;
    return { ...decision, core: r, r: r + (decision.changes ? 4 : 0) };
  }).sort((a, b) => b.importance - a.importance);
}



/**
 * Writes one decision bubble's tooltip.
 *
 * Purpose: Name the decision and why it is that size.
 *
 * @param decision Decision with importance and text.
 * @returns Plain text.
 */
function bubbleTip(decision) {
  // Long decisions are cut, not wrapped forever.
  const why = `reach ${decision.reach} issue${decision.reach === 1 ? "" : "s"}${decision.changes ? `, changes ${decision.changes}` : ""}`;
  const text = decision.text.length > 220 ? `${decision.text.slice(0, 220)}…` : decision.text;
  return `${decision.id} · importance ${decision.importance} (${why})\n${text}`;
}



/**
 * Draws one placed bubble with its ring and label.
 *
 * Purpose: Shade and size both say importance.
 *
 * @param item Placed bubble.
 * @param x Band's left edge.
 * @param scale Importance threshold for the bright shade.
 * @returns SVG markup.
 */
function bubbleSvg(item, x, scale) {
  // Only bubbles big enough carry their ID.
  const [cx, cy] = [x + item.x, LAYOUT.title + item.y];
  const shade = item.importance >= scale.big ? "big" : item.importance >= 1 ? "medium" : "small";
  const ring = item.changes ? `<circle class="ring" cx="${cx}" cy="${cy}" r="${item.core + 2.5}"></circle>` : "";
  const label = item.core >= 12 ? `<text class="bubble-label" x="${cx}" y="${cy + 4}" font-size="${Math.min(13, item.core * 0.7)}">${item.id}</text>` : "";
  return `<g data-tip="${escapeHtml(bubbleTip(item))}">${ring}<circle class="bubble ${shade}" cx="${cx}" cy="${cy}" r="${item.core}"></circle>${label}</g>`;
}



/**
 * Draws one day's packed bubbles.
 *
 * Purpose: The decision half of a day column.
 *
 * @param bubbles Sized bubbles for the day.
 * @param x Band's left edge.
 * @param box Band width and height.
 * @param scale Importance thresholds for shades.
 * @returns SVG markup.
 */
function bubblesSvg(bubbles, x, box, scale) {
  // Bubbles that did not fit are counted in a corner.
  const { placed, hidden } = packBand(bubbles, box);
  const more = hidden ? `<text x="${x + box.width - 4}" y="${LAYOUT.title + box.height - 4}" text-anchor="end">+${hidden} more</text>` : "";
  return placed.map((item) => bubbleSvg(item, x, scale)).join("") + more;
}



/**
 * Draws one day's merged-PR bar with its count.
 *
 * Purpose: Progress, one bar per day.
 *
 * @param day Day with merged, types, and closed.
 * @param x Band's left edge.
 * @param width Band width.
 * @param top Top of the PR lane.
 * @param max Most PRs merged in a day.
 * @returns SVG markup.
 */
function barSvg(day, x, width, top, max) {
  // Count above the bar; types in the tooltip.
  const base = top + LAYOUT.title + LAYOUT.bars;
  const height = day.merged ? Math.max(3, (day.merged / max) * (LAYOUT.bars - 16)) : 0;
  const bar = Math.min(56, width * 0.4);
  const types = TYPES.filter((type) => day.types[type]).map((type) => `${day.types[type]} ${type}`).join(", ");
  const tip = `${dayLabel(day.date)} · ${day.merged} PRs merged${types ? `\n${types}` : ""}\n${day.closed} issues closed`;
  const rect = height ? `<rect class="bar" x="${x + (width - bar) / 2}" y="${base - height}" width="${bar}" height="${height}" rx="3"></rect>` : "";
  return `<g data-tip="${escapeHtml(tip)}">${rect}<text class="count" x="${x + width / 2}" y="${base - height - 5}">${day.merged || ""}</text>
    <rect class="hit" x="${x}" y="${top + LAYOUT.title}" width="${width}" height="${LAYOUT.bars}"></rect></g>`;
}



/**
 * Draws one day's column: bubbles, bar, and label.
 *
 * Purpose: Keep each day's marks in its own band.
 *
 * @param day Day with decisions, merges, and closes.
 * @param index Column position, oldest first.
 * @param bubbles The day's sized bubbles.
 * @param frame Band, box, scale, lane top, height, and max.
 * @returns SVG markup.
 */
function columnSvg(day, index, bubbles, frame) {
  // A faint divider separates days.
  const x = index * frame.band;
  const divider = index ? `<line class="divider" x1="${x}" x2="${x}" y1="${LAYOUT.title}" y2="${frame.height - LAYOUT.axis}"></line>` : "";
  const label = `<text class="day" x="${x + frame.band / 2}" y="${frame.height - 18}">${escapeHtml(dayLabel(day.date))}</text>`
    + `<text class="day sub" x="${x + frame.band / 2}" y="${frame.height - 4}">${day.decisions.length} decisions</text>`;
  return divider + bubblesSvg(bubbles, x, frame.box, frame.scale) + barSvg(day, x, frame.band, frame.top, frame.max) + label;
}



/**
 * Draws the whole day map.
 *
 * Purpose: Which days held big decisions, and what shipped.
 *
 * @param columns Days of the run, oldest first.
 * @param width Available width in pixels.
 * @returns SVG markup.
 */
export function mapSvg(columns, width) {
  // Radii scale to the biggest decision in view.
  const band = width / columns.length;
  const all = columns.flatMap((day) => day.decisions);
  const scale = { max: Math.max(1, ...all.map((item) => item.importance)), min: 3, top: Math.min(36, band / 4) };
  scale.big = Math.max(2, scale.max * 0.2);
  const bubbles = columns.map((day) => bubblesOf(day.decisions, scale));
  const box = { width: band, height: bandHeight(bubbles, band) };
  const top = LAYOUT.title + box.height;
  const height = top + LAYOUT.title + LAYOUT.bars + LAYOUT.axis;
  const max = Math.max(1, ...columns.map((day) => day.merged));

  // Lane titles, then each day's column.
  const titles = `<text class="lane" x="0" y="13">Decisions · bubble size is importance</text><text class="lane" x="0" y="${top + 13}">PRs merged</text>`;
  const frame = { band, box, scale, top, height, max };
  const days = columns.map((day, index) => columnSvg(day, index, bubbles[index], frame)).join("");
  return `<svg class="day-map" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="Decisions by importance and PRs merged, per day">${titles}${days}</svg>`;
}
