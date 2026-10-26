// Handles the new-worker form and switching between tabs.
// Keeps one-off actions out of the live session code.

import { renderMap } from "./map/render.js";
import { byId, project } from "./panels.js";
import { openProgress } from "./progress/render.js";
import { openStatus } from "./status/controls.js";
import { openVersions } from "./versions/controls.js";



/**
 * Starts a worker from the sidebar form.
 *
 * Purpose: Let the owner start a worker without the master.
 *
 * @param event Form submit event.
 * @param attach Callback that shows the new session.
 * @returns Promise resolving when the request finishes.
 */
export async function startWorker(event, attach) {
  // Post the form; show progress and errors inline.
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target));
  byId("worker-error").textContent = "Creating worktree… (about 15 seconds)";
  const response = await fetch("/api/sessions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
  const body = await response.json();
  byId("worker-error").textContent = response.ok ? "" : body.error;
  if (response.ok) attach(body.name);
}



/**
 * Loads the project's name, owner, and mode.
 *
 * Purpose: Name the owner and label the start button.
 *
 * Inputs: None.
 *
 * @returns Promise resolving once the page is updated.
 */
export async function loadProject() {
  // A failed fetch keeps the generic wording.
  try {
    Object.assign(project, await (await fetch("/api/project")).json());
  } catch {
    return;
  }
  const setup = project.mode === "setup";
  document.title = project.project ? `${project.project} · C³` : "C³";
  byId("kickoff-button").textContent = setup ? "Start setup" : "Start the day";
  byId("kickoff-hint").textContent = setup
    ? "It reads the repository, interviews you, and writes the rules and founding decisions."
    : "It tells you what needs you, then asks the master to plan the day. Or type your own message below.";
}



/**
 * Sends the assistant its first message.
 *
 * Purpose: Start setup or the day when the owner chooses.
 *
 * @param button The start button, disabled while sending.
 * @returns Promise resolving when the server answers.
 */
export async function kickoff(button) {
  // The server refuses when the assistant already has a conversation.
  button.disabled = true;
  await fetch("/api/kickoff", { method: "POST" });
  button.disabled = false;
}



/**
 * Switches between Home, Sessions, Map, Progress, Versions, Status.
 *
 * Purpose: Load slower views only when opened.
 *
 * @param tab Tab name.
 * @param sessions Live sessions, for in-progress work on the Map.
 * @returns Promise resolving when the tab is drawn.
 */
export async function showTab(tab, sessions) {
  // Toggle panels; the terminal refits itself when shown.
  for (const button of document.querySelectorAll("nav button")) button.classList.toggle("active", button.dataset.tab === tab);
  for (const name of ["home", "sessions", "map", "progress", "versions", "status"]) byId(`tab-${name}`).classList.toggle("hidden", name !== tab);
  if (tab === "home" || tab === "sessions") return;
  const element = byId(tab);
  if (tab === "status") return openStatus(element);
  if (tab === "versions") return openVersions(element);
  if (tab === "progress") return openProgress(element);

  // The Map fetches once per open.
  element.textContent = "Loading…";
  renderMap(element, await (await fetch("/api/map")).json(), sessions);
}
