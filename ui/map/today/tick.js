// Draws Today's plan checkboxes and saves their ticks.
// Shows a tick at once; undoes it if saving fails.

import { escapeHtml } from "../../panels.js";

/** Plan sections the owner ticks; decisions are answered elsewhere. */
const TICKABLE = ["bundle", "task", "test", "other"];

/** Ticks still saving; fresh data waits until none are. */
let saving = 0;



/**
 * Draws a plan line's checkbox, which ticks it on GitHub.
 *
 * Purpose: Let the owner approve lines from the Map.
 *
 * @param line Plan line, or null outside the plan.
 * @returns HTML checkbox, or "" for lines nobody ticks.
 */
export function tickBox(line) {
  // Disabled while saving, so one click saves once.
  if (!line || !TICKABLE.includes(line.kind)) return "";
  const state = `${line.checked ? " checked" : ""}${line.saving ? " disabled" : ""}`;
  return `<input type="checkbox" class="tick" data-action="tick" data-index="${line.index}"${state} title="${line.checked ? "Untick" : "Tick"} in the plan">`;
}



/**
 * Asks the server to save one line's new state.
 *
 * Purpose: Turn every failure into one readable message.
 *
 * @param plan Daily plan issue number.
 * @param line Plan line with index, text, and checked.
 * @returns Error message, or "" when saved.
 */
async function save(plan, line) {
  // The server re-reads the plan before editing it.
  try {
    const body = JSON.stringify({ plan, index: line.index, text: line.text, checked: line.checked });
    const response = await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body });
    return response.ok ? "" : (await response.json()).error ?? "Saving the tick failed.";
  } catch (error) {
    return `Saving the tick failed: ${error.message}`;
  }
}



/**
 * Reloads the map once every tick is saved.
 *
 * Purpose: Pick up statuses without undoing a pending tick.
 *
 * @param view Map view with its server map.
 * @param redraw Callback that redraws the Map.
 * @returns Promise resolving when redrawn.
 */
async function refresh(view, redraw) {
  // Older data would flip a newer, unsaved tick back.
  const map = await (await fetch("/api/map?fresh=1")).json();
  if (saving) return;
  view.map = map;
  redraw();
}



/**
 * Ticks or unticks one plan line from its checkbox.
 *
 * Purpose: Approve work in the Map instead of on GitHub.
 *
 * @param box The clicked checkbox.
 * @param view Map view with its server map and element.
 * @param redraw Callback that redraws the Map.
 * @returns Promise resolving when the tick is saved or undone.
 */
export async function tickLine(box, view, redraw) {
  // Show the new state first; one save per line.
  const today = view.map.today;
  const line = today?.items.find((item) => item.index === Number(box.dataset.index));
  if (!line || line.saving || !today.plan) return;
  Object.assign(line, { checked: !line.checked, saving: true });
  saving += 1;
  redraw();

  // A refusal puts the box back and says why.
  const error = await save(today.plan.number, line);
  saving -= 1;
  line.saving = false;
  if (error) line.checked = !line.checked;
  redraw();
  if (error) view.element.querySelector(".today-head")?.insertAdjacentHTML("beforeend", `<span class="error">${escapeHtml(error)}</span>`);
  else await refresh(view, redraw);
}
