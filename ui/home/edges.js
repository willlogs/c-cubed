// Draws Home's connection lines and their message labels.
// Runs after layout, from the cards' positions on the page.

import { ago } from "../sessions/list.js";

/** Deliveries this recent keep a line highlighted. */
const RECENT_MS = 10 * 60_000;



/**
 * Measures a card relative to the drawing area.
 *
 * Purpose: Place lines in the overlay's coordinates.
 *
 * @param area The Home drawing area.
 * @param name Node name in data-node.
 * @returns Left, top, width, and height, or null.
 */
function nodeBox(area, name) {
  // Cards that are not on the page draw no line.
  const element = area.querySelector(`[data-node="${CSS.escape(name)}"]`);
  if (!element) return null;
  const outer = area.getBoundingClientRect();
  const inner = element.getBoundingClientRect();
  return { left: inner.left - outer.left, top: inner.top - outer.top, width: inner.width, height: inner.height };
}



/**
 * Builds one edge's path, style, and label.
 *
 * Purpose: Join row neighbors sideways, rows top to bottom.
 *
 * @param area The Home drawing area.
 * @param edge Edge from the model.
 * @returns Path data, class, label, and midpoint, or null.
 */
function edgeShape(area, edge) {
  // Both ends must be visible.
  const a = nodeBox(area, edge.from);
  const b = nodeBox(area, edge.to);
  if (!a || !b) return null;
  const sameRow = Math.abs(a.top - b.top) < a.height / 2;
  const start = sameRow ? { x: a.left + a.width, y: a.top + a.height / 2 } : { x: a.left + a.width / 2, y: a.top + a.height };
  const end = sameRow ? { x: b.left, y: b.top + b.height / 2 } : { x: b.left + b.width / 2, y: b.top };
  const bend = (start.y + end.y) / 2;
  const d = sameRow ? `M${start.x},${start.y} L${end.x},${end.y}` : `M${start.x},${start.y} C${start.x},${bend} ${end.x},${bend} ${end.x},${end.y}`;

  // Waiting messages outrank a recent delivery.
  const recent = edge.lastAt && Date.now() - edge.lastAt < RECENT_MS;
  const kind = edge.waiting.length ? "waiting" : recent ? "recent" : "";
  const label = edge.waiting.length ? `${edge.waiting.length} waiting` : recent ? `message ${ago(edge.lastAt)} ago` : "";
  return { d, kind, label, x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
}



/**
 * Draws every edge into the overlay.
 *
 * Purpose: Show who talks to whom and what waits.
 *
 * @param area Home drawing area with svg and labels.
 * @param edges Edges from the model.
 * @returns No value.
 */
export function drawEdges(area, edges) {
  // Size the overlay, then draw paths and labels.
  const svg = area.querySelector("svg.home-edges");
  const labels = area.querySelector(".home-labels");
  if (!svg || !labels) return;
  svg.setAttribute("width", area.scrollWidth);
  svg.setAttribute("height", area.scrollHeight);
  const shapes = edges.map((edge) => edgeShape(area, edge)).filter(Boolean);
  svg.innerHTML = shapes.map((shape) => `<path class="${shape.kind}" d="${shape.d}"/>`).join("");
  labels.innerHTML = shapes.filter((shape) => shape.label)
    .map((shape) => `<span class="edge-label ${shape.kind}" style="left:${shape.x}px;top:${shape.y}px">${shape.label}</span>`).join("");
}
