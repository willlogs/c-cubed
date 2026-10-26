// Builds Home's session cards, progress tracks, and ended row.
// Returns HTML strings; render.js places them and draws lines.

import { escapeHtml } from "../panels.js";
import { ago, stateOf } from "../sessions/list.js";

/** A worker's progress steps, in order. */
const STEPS = ["working", "PR open", "merged"];

/** What each control session is for. */
const PURPOSE = { assistant: "talks with you", master: "directs the workers" };



/**
 * Renders a worker's three-step progress track.
 *
 * Purpose: Show at a glance how far the work got.
 *
 * @param step 1 working, 2 PR open, 3 merged.
 * @returns HTML for the track.
 */
function progressTrack(step) {
  // Reached steps are filled; the current one is marked.
  return `<ol class="track">${STEPS.map((label, index) => {
    // Earlier steps are done; merged completes the track.
    const kind = index + 1 < step || step === STEPS.length ? "done" : index + 1 === step ? "now" : "";
    return `<li class="${kind}">${label}</li>`;
  }).join("")}</ol>`;
}



/**
 * Renders a worker's issue and pull request lines.
 *
 * Purpose: Name the work with links to GitHub.
 *
 * @param work Issue, PR, and step from the model.
 * @returns HTML for the work section, or empty.
 */
function workLines(work) {
  // Links open GitHub in a new tab.
  if (!work) return "";
  const issue = `<a href="${escapeHtml(work.url ?? "#")}" target="_blank" rel="noopener">#${work.number}</a> ${escapeHtml(work.title)}`;
  const pr = work.pr ? `<a href="${escapeHtml(work.pr.url)}" target="_blank" rel="noopener">PR #${work.pr.number}</a> <span class="badge ${work.pr.state}">${work.pr.state.toLowerCase()}</span>` : "no PR yet";
  return `<p class="work">${issue}</p><p class="pr">${pr}</p>${progressTrack(work.step)}`;
}



/**
 * Renders one session as a clickable card.
 *
 * Purpose: Show role, state, activity, work, and cost.
 *
 * @param card Card data from the model.
 * @returns HTML for the card.
 */
export function sessionCard(card) {
  // The whole card opens the session's terminal.
  const { session, doing, work, share } = card;
  const { dot, words } = stateOf(session);
  const role = PURPOSE[session.kind] ?? "worker";
  const cost = typeof share?.five_hour === "number" ? ` · 5h +${share.five_hour.toFixed(1)}%` : "";
  const activity = doing ? `<p class="doing" title="${escapeHtml(doing.text)}">${escapeHtml(doing.text)} <span class="when">${ago(doing.at)} ago</span></p>` : `<p class="doing quiet">No activity yet</p>`;
  return `<article class="home-card ${escapeHtml(session.kind)} ${dot}" data-node="${escapeHtml(session.name)}" data-open="${escapeHtml(session.name)}">
    <header><span class="dot ${dot}"></span><strong>${escapeHtml(session.name)}</strong></header>
    <p class="role">${escapeHtml(role)} · ${escapeHtml(session.meta.model ?? "")}</p>
    <p class="state ${dot}">${escapeHtml(words)} · up ${ago(session.startedAt)}${cost}</p>
    ${activity}${workLines(work)}
  </article>`;
}



/**
 * Renders the owner's own card at the top.
 *
 * Purpose: Anchor the picture: everything starts with the owner.
 *
 * Inputs: None.
 *
 * @returns HTML for the owner's card.
 */
export function ownerCard() {
  // Clicking it opens the assistant, the owner's way in.
  return `<article class="home-card owner" data-node="owner" data-open="assistant">
    <header><strong>You</strong></header><p class="role">Talk to the assistant: click here, or press the start button.</p></article>`;
}



/**
 * Renders ended sessions as one compact row.
 *
 * Purpose: Keep finished work visible without crowding.
 *
 * @param ended Ended session summaries.
 * @returns HTML for the row, or empty.
 */
export function endedRow(ended) {
  // Each name opens the ended session's log.
  if (!ended.length) return "";
  const names = ended.map((session) => `<button class="ghost" data-open="${escapeHtml(session.name)}">${escapeHtml(session.name)} · ${ago(session.endedAt)} ago</button>`).join("");
  return `<section class="home-ended"><h2>Ended</h2>${names}</section>`;
}
