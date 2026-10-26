// Loads the Versions tab, handles its form, fills the badge.
// The server talks to GitHub; this only asks and redraws.

import { escapeHtml } from "../panels.js";
import { renderVersions } from "./render.js";

/** Tab state: payload, form progress and error, load error. */
const view = { element: null, data: null, sending: false, formError: null, loadError: null };



/**
 * Shows the Versions tab.
 *
 * Purpose: Entry point when the owner opens Versions.
 *
 * @param element Versions container.
 * @returns Promise resolving after the first draw.
 */
export async function openVersions(element) {
  // Wire events once; later opens only reload.
  if (!element.dataset.wired) {
    element.addEventListener("click", (event) => { if (event.target.dataset.act === "refresh") load(true); });
    element.addEventListener("submit", onSubmit);
  }
  element.dataset.wired = "1";
  view.element = element;
  if (!view.data) element.textContent = "Loading…";
  await load(false);
}



/**
 * Fetches versions and redraws.
 *
 * Purpose: Show GitHub's current state of every version.
 *
 * @param fresh Whether to skip the server's GitHub cache.
 * @returns Promise resolving after the redraw.
 */
async function load(fresh) {
  // Keep the last data when a reload fails.
  try {
    const response = await fetch(`/api/versions${fresh ? "?fresh" : ""}`);
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    Object.assign(view, { data: body, loadError: null });
  } catch (error) {
    view.loadError = `Versions failed to load: ${error.message}`;
  }
  if (view.data) renderVersions(view.element, view.data, view);
  else view.element.innerHTML = `<p class="error">${escapeHtml(view.loadError)}</p>`;
}



/**
 * Creates a version from the form.
 *
 * Purpose: Define a version without leaving the page.
 *
 * @param event Form submit event.
 * @returns Promise resolving after the redraw.
 *
 * Side effects: Creates a milestone on GitHub.
 */
async function onSubmit(event) {
  // Post the form, then reload fresh on success.
  event.preventDefault();
  const form = Object.fromEntries(new FormData(event.target));
  Object.assign(view, { sending: true, formError: null });
  renderVersions(view.element, view.data, view);
  let created = false;
  try {
    const response = await fetch("/api/versions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const body = await response.json();
    created = response.ok;
    view.formError = created ? null : body.error;
  } catch (error) {
    // A dropped connection must not leave "Creating…" up.
    view.formError = error.message;
  }
  view.sending = false;
  await load(created);
}



/**
 * Fills the header badge with the current version.
 *
 * Purpose: Show the central version on every tab.
 *
 * @param element Header badge element.
 * @returns Promise resolving once the badge is filled.
 */
export async function showCurrentVersion(element) {
  // A failure leaves a neutral badge, not an error.
  try {
    // Projects without versions show no badge.
    const { current } = await (await fetch("/api/version")).json();
    element.textContent = current ? `v${current}` : "";
    element.classList.toggle("hidden", !current);
  } catch {
    element.textContent = "version ?";
  }
}
