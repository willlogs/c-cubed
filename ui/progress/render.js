// Lays out the Progress tab: tiles, heatmap, day map.
// Charts only; hovering any mark names what it shows.

import { escapeHtml } from "../panels.js";
import { dayLabel, heatmapHtml } from "./charts/heatmap.js";
import { mapSvg } from "./charts/map.js";
import { tilesHtml } from "./charts/tiles.js";

/** Tab state: payload and load error. */
const view = { element: null, data: null, loadError: null };



/**
 * Shows the Progress tab.
 *
 * Purpose: Entry point when the owner opens Progress.
 *
 * @param element Progress container.
 * @returns Promise resolving after the first draw.
 */
export async function openProgress(element) {
  // Wire events once; later opens only reload.
  if (!element.dataset.wired) wire(element);
  element.dataset.wired = "1";
  view.element = element;
  if (!view.data) element.textContent = "Loading… (reads GitHub and the decision register)";
  await load(false);
}



/**
 * Wires Refresh, tooltips, and resizes.
 *
 * Purpose: One set of listeners for every redraw.
 *
 * @param element Progress container.
 * @returns No value.
 */
function wire(element) {
  // Delegated, so redraws keep working.
  element.addEventListener("click", (event) => { if (event.target.dataset.act === "refresh") load(true); });
  element.addEventListener("mousemove", (event) => showTip(event.target.closest("[data-tip]"), event));
  element.addEventListener("mouseleave", () => showTip(null));
  window.addEventListener("resize", () => { if (view.data && element.offsetParent) draw(); });
}



/**
 * Fetches the progress data and redraws.
 *
 * Purpose: Keep the last data when a reload fails.
 *
 * @param fresh Whether to skip the server's cache.
 * @returns Promise resolving after the redraw.
 */
async function load(fresh) {
  // Errors show above the last good charts.
  try {
    const response = await fetch(`/api/progress${fresh ? "?fresh" : ""}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    Object.assign(view, { data: body, loadError: null });
  } catch (error) {
    view.loadError = `Progress failed to load: ${error.message}`;
  }
  if (view.data) draw();
  else view.element.innerHTML = `<p class="error">${escapeHtml(view.loadError)}</p>`;
}



/**
 * Draws the whole tab from the current state.
 *
 * Purpose: One render for loads and resizes.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
function draw() {
  // The day map fills the container's width.
  const { data } = view;
  const since = dayLabel(data.start);
  const width = Math.max(560, Math.min(1200, view.element.clientWidth - 48));
  const error = view.loadError ? `<p class="error">${escapeHtml(view.loadError)}</p>` : "";
  const built = new Date(data.builtAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  view.element.innerHTML = `<div class="progress">
    <div class="progress-head"><span>Since ${escapeHtml(since)}, when this run of issues began · GitHub at ${built}</span>
      <button class="ghost" data-act="refresh">Refresh</button></div>${error}
    ${tilesHtml(data.totals, since)}
    <h3>PRs merged per day</h3>${heatmapHtml(data.heatmap)}
    <h3>Day by day</h3>${mapSvg(data.columns, width)}
    <p class="hint">Importance is how many issues a decision reaches, plus 3 when it changes an earlier decision; ringed bubbles do.</p></div>
    <div class="progress-tip" hidden></div>`;
}



/**
 * Shows or hides the shared tooltip.
 *
 * Purpose: Name what is under the pointer.
 *
 * @param target Element with data-tip, or null.
 * @param event Pointer event, for placement.
 * @returns No value.
 */
function showTip(target, event) {
  // Follow the pointer, offset so it never covers it.
  const tip = view.element?.querySelector(".progress-tip");
  if (!tip) return;
  tip.hidden = !target;
  if (!target) return;
  tip.textContent = target.dataset.tip;
  tip.style.left = `${Math.min(event.clientX + 14, window.innerWidth - 360)}px`;
  tip.style.top = `${event.clientY + 14}px`;
}
