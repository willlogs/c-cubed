// Draws the Map: Today, then decisions, work, and open questions.
// Owns what the reader opened; edges.js draws the lines.

import { decisionNode, questionNode, STATUS_WORDS, workCard } from "./cards.js";
import { drawEdges, wireHighlight } from "./edges.js";
import { buildView } from "./model.js";
import { buildToday } from "./today/model/groups.js";
import { todayPanel } from "./today/panel.js";
import { tickLine } from "./today/tick.js";

/** Open-state key for the one control that unfolds all history. */
const UNFOLD_KEY = "unfolded";

/** What the reader opened, kept across redraws and refreshes. */
const view = { open: new Set(), map: null, sessions: [], element: null, edges: [] };



/**
 * Draws one colored status count.
 *
 * Purpose: Make the summary double as the color legend.
 *
 * @param status Status name.
 * @param count Open parts with that status.
 * @returns HTML stat.
 */
function statPill(status, count) {
  // The dot matches the graph's colors.
  return `<span class="stat"><span class="sdot ${status}"></span><b>${count}</b> ${STATUS_WORDS[status]}</span>`;
}



/**
 * Draws the summary line that doubles as the legend.
 *
 * Purpose: Answer "what needs me, what moves" before any detail.
 *
 * @param model View model from buildView.
 * @returns HTML summary bar.
 */
function summary(model) {
  // One colored count per status; Today links the plan.
  return `<div class="map-summary">
    <span class="stat you"><span class="sdot question"></span><b>${model.questions.length}</b> decisions waiting on you</span>
    ${Object.entries(model.counts).map(([status, count]) => statPill(status, count)).join("")}
    <span class="spacer"></span>${foldButton(model)}<button class="ghost" data-action="refresh">Refresh</button></div>`;
}



/**
 * Draws the left column: decisions, newest first.
 *
 * Purpose: Show why work exists; older decisions are grayed.
 *
 * @param model View model.
 * @returns HTML column.
 */
function decidedColumn(model) {
  // Folded decisions appear only while unfolded.
  const nodes = model.decisions.map((decision) => decisionNode(decision, view.open.has(decision.key))).join("");
  return `<div class="map-col"><h3>Decided</h3>${nodes || '<p class="meta">None linked yet.</p>'}</div>`;
}



/**
 * Draws the middle column: open work, then shipped work.
 *
 * Purpose: Show progress now; unfolded, show shipped work too.
 *
 * @param model View model.
 * @returns HTML column.
 */
function workColumn(model) {
  // Shipped cards use the same card markup, grayed.
  const cards = [...model.cards, ...model.shipped].map((card) => workCard(card, view.open.has(`i:${card.number}`))).join("");
  return `<div class="map-col"><h3>Open work</h3>${cards || '<p class="meta">Nothing open.</p>'}</div>`;
}



/**
 * Draws the control that folds and unfolds history.
 *
 * Purpose: One click shows or hides all folded history.
 *
 * @param model View model.
 * @returns HTML button.
 */
function foldButton(model) {
  // The count says how much is hidden.
  return `<button class="ghost" data-action="toggle" data-toggle="${UNFOLD_KEY}">${view.open.has(UNFOLD_KEY) ? "Fold" : "Unfold"} ${model.foldedCount} older</button>`;
}



/**
 * Draws the right column: questions waiting on the owner.
 *
 * Purpose: Hang open choices beside the work they block.
 *
 * @param model View model.
 * @returns HTML column.
 */
function openColumn(model) {
  // An empty column still explains itself.
  const questions = model.questions.map(questionNode).join("") || '<p class="meta">Nothing waiting on you.</p>';
  return `<div class="map-col"><h3>Waiting on your decision</h3>${questions}</div>`;
}



/**
 * Redraws the whole Map from the stored data.
 *
 * Purpose: Apply toggles and refreshes in one place.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
function redraw() {
  // Today first, then the graph; lines need the laid-out page.
  const model = buildView(view.map, view.sessions, view.open.has(UNFOLD_KEY));
  const built = new Date(view.map.builtAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  view.edges = model.edges;
  view.element.innerHTML = `${todayPanel(buildToday(view.map, view.sessions), view.open)}${summary(model)}
    <div class="map-graph"><svg class="map-edges"></svg>${decidedColumn(model)}${workColumn(model)}${openColumn(model)}</div>
    <p class="meta">Built ${built}. Links come from GitHub relationships (sub-issues and blocked by), decision IDs such as D10, and issue numbers in the Decision Register.</p>`;

  // Hovering graph nodes or Today items lights the graph.
  const graph = view.element.querySelector(".map-graph");
  wireHighlight(graph, model.edges);
  wireHighlight(graph, model.edges, view.element.querySelector(".today"));
  requestAnimationFrame(() => drawEdges(graph, model.edges));
}



/**
 * Handles clicks on toggles and the refresh button.
 *
 * Purpose: Open and close parts without losing state.
 *
 * @param event Click event inside the Map.
 * @returns Promise resolving when the Map is redrawn.
 */
async function handleClick(event) {
  // Links open GitHub; only data-action elements act here.
  if (event.target.closest("a")) return;
  const target = event.target.closest("[data-action]");
  if (target?.dataset.action === "tick") return tickLine(target, view, redraw);
  if (target?.dataset.action === "toggle") {
    const key = target.dataset.toggle;
    if (!view.open.delete(key)) view.open.add(key);
    return redraw();
  }
  if (target?.dataset.action === "refresh") {
    target.textContent = "Refreshing…";
    view.map = await (await fetch("/api/map?fresh=1")).json();
    redraw();
  }
}



/**
 * Shows the Map for the given data and sessions.
 *
 * Purpose: Entry point used when the Map tab opens.
 *
 * @param element Map container.
 * @param map Server map payload.
 * @param sessions Live sessions, for in-progress work.
 * @returns No value.
 */
export function renderMap(element, map, sessions) {
  // Store inputs, wire clicks once, then draw.
  Object.assign(view, { element, map, sessions });
  element.onclick = handleClick;
  redraw();
}



// Lines follow the layout when the window changes size.
window.addEventListener("resize", () => {
  // Only redraw lines while the Map is on screen.
  const graph = view.element?.querySelector(".map-graph");
  if (graph?.offsetParent) drawEdges(graph, view.edges);
});
