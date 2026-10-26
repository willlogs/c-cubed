// Lays out the Versions tab: current, define form, open, shipped.
// Pure rendering; controls.js fetches data and handles the form.

import { escapeHtml } from "../panels.js";
import { openCardHtml, shippedCardHtml } from "./cards.js";

/** The define-a-version form; bump defaults to minor. */
const FORM = `<form class="version-form" data-form="version">
  <label>Goal <input name="goal" required placeholder="In-app sign-in"></label>
  <label>Why <textarea name="about" rows="3" placeholder="What reaching it changes, in your words."></textarea></label>
  <label>Bump <select name="bump"><option value="minor">minor</option><option value="major">major</option><option value="patch">patch (hotfix)</option></select></label>
  <button type="submit">Create milestone</button></form>`;



/**
 * Draws the define-a-version panel.
 *
 * Purpose: Let the owner define a version from the page.
 *
 * @param view Form error and whether it is sending.
 * @param empty Whether no version is open, which unfolds it.
 * @returns HTML details element.
 */
function defineHtml(view, empty) {
  // Errors and progress show under the form.
  const note = view.sending ? "Creating milestone…" : view.formError ?? "";
  return `<details class="version-define"${empty || view.formError ? " open" : ""}><summary>Define a version</summary>
    ${FORM}<p class="error">${escapeHtml(note)}</p>
    <p class="hint">Then add its decision, research, and work issues to the milestone on GitHub, or with <code>npm run cc -- version add</code>.</p></details>`;
}



/**
 * Draws one titled list of version cards.
 *
 * Purpose: Same frame for open and shipped versions.
 *
 * @param title Section heading.
 * @param cards Card HTML strings.
 * @param empty Text when there are no cards.
 * @returns HTML section.
 */
function sectionHtml(title, cards, empty) {
  // Counts sit beside the heading.
  const body = cards.length ? cards.join("") : `<p class="empty">${empty}</p>`;
  return `<section class="version-section"><h3>${title} <span class="count">${cards.length}</span></h3>${body}</section>`;
}



/**
 * Draws the whole Versions tab.
 *
 * Purpose: One page from goal to changelog.
 *
 * @param element Versions container.
 * @param data Payload from /api/versions.
 * @param view Form state and load error.
 * @returns No value.
 */
export function renderVersions(element, data, view) {
  // Head, define form, open versions, then the trail.
  const error = view.loadError ? `<p class="error">${escapeHtml(view.loadError)}</p>` : "";
  const built = new Date(data.builtAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const current = data.current ? `Current version <strong>v${escapeHtml(data.current)}</strong>` : "No versions yet: set versions.file in command-center.json";
  element.innerHTML = `<div class="versions">
    <div class="versions-head"><span>${current} · GitHub at ${built}</span>
      <button class="ghost" data-act="refresh">Refresh</button></div>${error}${defineHtml(view, !data.open.length)}
    ${sectionHtml("Open versions", data.open.map(openCardHtml), "No open versions. Define one above.")}
    ${sectionHtml("Changelog", data.shipped.map(shippedCardHtml), "Nothing shipped as a version yet.")}</div>`;
}
