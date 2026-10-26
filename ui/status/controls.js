// Loads the Status tab, wires its buttons, and polls.
// The server runs every action; this only asks and redraws.

import { escapeHtml } from "../panels.js";
import { renderStacks } from "./render.js";

/** Poll quickly while a job runs, slowly otherwise. */
const POLL_MS = { busy: 2000, idle: 15000 };

/** Tab state: payload, confirm question, request and load errors. */
const view = { element: null, data: null, confirming: null, errors: {}, loadError: null, timer: null };



/**
 * Shows the Status tab and keeps it current.
 *
 * Purpose: Entry point when the owner opens Status.
 *
 * @param element Status container.
 * @returns Promise resolving after the first draw.
 */
export async function openStatus(element) {
  // Wire clicks once; later opens only reload.
  if (!element.dataset.wired) element.addEventListener("click", onClick);
  element.dataset.wired = "1";
  view.element = element;
  if (!view.data) element.textContent = "Loading…";
  await load(false);
}



/**
 * Fetches the rows, redraws, and schedules the next poll.
 *
 * Purpose: Keep progress and states live while visible.
 *
 * @param fresh Whether to skip the server's GitHub cache.
 * @returns Promise resolving after the redraw.
 */
async function load(fresh) {
  // One timer at a time, even after fast clicks.
  clearTimeout(view.timer);
  try {
    const response = await fetch(`/api/stacks${fresh ? "?fresh" : ""}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    Object.assign(view, { data: body, loadError: null });
  } catch (error) {
    // Keep the last rows; say why they may be stale.
    view.loadError = `Status failed to load: ${error.message}`;
  }
  if (view.data) renderStacks(view.element, view.data, view);
  else view.element.innerHTML = `<p class="error">${escapeHtml(view.loadError)}</p>`;
  schedule();
}



/**
 * Plans the next poll while the tab is visible.
 *
 * Purpose: Poll fast during jobs and stop when hidden.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
function schedule() {
  // Opening the tab again restarts polling.
  if (view.element.closest(".tab")?.classList.contains("hidden")) return;
  const busy = view.data?.rows.some((row) => row.job?.state === "running");
  view.timer = setTimeout(() => load(false), busy ? POLL_MS.busy : POLL_MS.idle);
}



/**
 * Handles every button in the Status tab.
 *
 * Purpose: One delegated listener survives redraws.
 *
 * @param event Click event.
 * @returns Promise resolving after any request.
 */
async function onClick(event) {
  // Buttons name their action; rows name their id.
  const button = event.target.closest("button[data-act]");
  if (!button) return;
  const act = button.dataset.act;
  const id = button.closest("[data-id]")?.dataset.id;
  if (act === "refresh") return load(true);
  if (act === "cancel") return redraw(null);

  // Some clicks ask first; a confirm click sends with force.
  const question = questionFor(act, id);
  if (question) return redraw({ id, act, text: question });
  button.disabled = true;
  const confirmed = act.endsWith("-confirm");
  await post(confirmed ? act.slice(0, -"-confirm".length) : act, { id, force: confirmed });
}



/**
 * Sends one action and shows its outcome.
 *
 * Purpose: Errors land on the row; 409 asks to confirm.
 *
 * @param action Stack action such as start or stop.
 * @param body Row id and whether the owner confirmed.
 * @returns Promise resolving after the reload.
 */
async function post(action, body) {
  // The job itself reports progress through polling.
  view.confirming = null;
  delete view.errors[body.id];
  try {
    const response = await fetch(`/api/stacks/${action}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const result = await response.json();
    if (response.status === 409) view.confirming = { id: body.id, act: action, text: result.confirm };
    else if (!response.ok) view.errors[body.id] = result.error;
  } catch (error) {
    // A dropped connection is a row error too.
    view.errors[body.id] = error.message;
  }
  await load(false);
}



/**
 * Returns the question a click must answer first, if any.
 *
 * Purpose: Ask before worker stops and removes.
 *
 * @param act Clicked action.
 * @param id Row id.
 * @returns Question text, or null to act at once.
 */
function questionFor(act, id) {
  // The server asks again if the data went stale.
  const row = [...view.data.rows, ...view.data.others.map((item) => ({ ...item, instance: item.name }))].find((item) => item.id === id);
  if (!row) return null;
  if (act === "stop" && row.worker) return `Worker ${row.worker} is running and may be using ${row.instance}. Stopping it may break its check.`;
  if (act === "remove") return `Remove the worktree ${row.instance}? Its stack stops too. Uncommitted changes block this, and unmerged branches stay.`;
  return null;
}



/**
 * Redraws with a different question awaiting an answer.
 *
 * Purpose: Show or hide the confirm strip.
 *
 * @param question Row id, action, and text; or null.
 * @returns No value.
 */
function redraw(question) {
  // No fetch: the data has not changed.
  view.confirming = question;
  renderStacks(view.element, view.data, view);
}
