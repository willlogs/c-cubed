// Draws Home: the owner, the control pair, workers, messages.
// Redraws live, throttled; refreshes GitHub data each minute.

import { cancelQueued, queueItems } from "../sessions/queue.js";
import { endedRow, ownerCard, sessionCard } from "./cards.js";
import { drawEdges } from "./edges.js";
import { buildHome } from "./model.js";

/** How often issue and PR data refreshes. */
const MAP_MS = 60_000;

/** Shortest time between two redraws. */
const REDRAW_MS = 400;

/** GitHub data, the pending redraw, and its timer. */
const view = { map: null, mapAt: 0, loading: false, pending: null, timer: null };



/**
 * Fetches issue and PR data when it is stale.
 *
 * Purpose: Name each worker's issue and pull request.
 *
 * Inputs: None.
 *
 * @returns Promise resolving true when new data arrived.
 */
async function refreshMap() {
  // One request at a time; failures keep old data.
  if (view.loading || Date.now() - view.mapAt < MAP_MS) return false;
  view.loading = true;
  try {
    view.map = await (await fetch("/api/map")).json();
    view.mapAt = Date.now();
    return true;
  } catch {
    return false;
  } finally {
    view.loading = false;
  }
}



/**
 * Handles clicks on cards, names, and Cancel buttons.
 *
 * Purpose: Open sessions and cancel messages from Home.
 *
 * @param event Click event inside Home.
 * @param onOpen Callback that shows a session's terminal.
 * @returns No value.
 */
function handleClick(event, onOpen) {
  // Links keep their own behavior.
  if (event.target.closest("a")) return;
  const cancel = event.target.dataset.cancel;
  if (cancel) return void cancelQueued(cancel);
  const target = event.target.closest("[data-open]");
  if (target) onOpen(target.dataset.open);
}



/**
 * Draws Home now from the latest pending state.
 *
 * Purpose: Do the actual redraw behind the throttle.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
function flush() {
  // Hidden tabs skip drawing until shown.
  view.timer = null;
  const { element, state, onOpen } = view.pending;
  if (element.closest(".tab")?.classList.contains("hidden")) return;
  const home = buildHome({ ...state, port: location.port }, view.map);
  element.innerHTML = `<div class="home">
      <div class="home-row">${ownerCard()}</div>
      <div class="home-row control">${home.control.map(sessionCard).join("")}</div>
      <div class="home-row workers">${home.workers.map(sessionCard).join("") || `<p class="quiet">No workers running.</p>`}</div>
      <svg class="home-edges"></svg><div class="home-labels"></div>
    </div>
    <section class="home-queue"><h2>Messages</h2><ul id="home-queue">${queueItems(state.queue)}</ul></section>
    ${endedRow(home.ended)}`;
  element.onclick = (event) => handleClick(event, onOpen);
  requestAnimationFrame(() => drawEdges(element.querySelector(".home"), home.edges));

  // Fetch issue data when stale, then draw again.
  refreshMap().then((fresh) => fresh && updateHome(element, state, onOpen));
}



/**
 * Schedules a Home redraw with the latest state.
 *
 * Purpose: Keep up with live events without redrawing constantly.
 *
 * @param element The Home container.
 * @param state Browser state: sessions, queue, events, usage.
 * @param onOpen Callback that shows a session's terminal.
 * @returns No value.
 */
export function updateHome(element, state, onOpen) {
  // Coalesce bursts of events into one redraw.
  view.pending = { element, state, onOpen };
  if (!view.timer) view.timer = setTimeout(flush, view.map ? REDRAW_MS : 0);
}
