// Draws one Status row: what, where it stands, buttons.
// Buttons follow the row's stage: create, then run and manage.

import { escapeHtml } from "../panels.js";

/** Confirm button wording per action. */
const CONFIRM_LABELS = { stop: "Stop anyway", remove: "Remove worktree" };



/**
 * Formats a time as a short age.
 *
 * Purpose: Say how fresh data and results are.
 *
 * @param when ISO string or epoch milliseconds.
 * @returns Text such as "12s ago", or "not loaded".
 */
export function ago(when) {
  // Seconds under a minute, then minutes.
  if (!when) return "not loaded";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(when).getTime()) / 1000));
  return seconds < 60 ? `${seconds}s ago` : `${Math.round(seconds / 60)}m ago`;
}



/**
 * Says which branch or worktree a row stands for.
 *
 * Purpose: Make clear what a click will check out.
 *
 * @param row Row from the server.
 * @returns One short line, or empty.
 */
function branchNote(row) {
  // PRs run merged with trunk; new issues get a branch.
  if (row.kind === "pr") return row.worktree ? `merge preview of ${row.branch}` : `${row.branch} · runs merged with the trunk`;
  if (row.kind === "issue" && !row.branch) return `new branch ${row.newBranch}`;
  return row.branch ?? "";
}



/**
 * Describes a row's stage: no worktree, stopped, or running.
 *
 * Purpose: Show progress while a job runs, then the result.
 *
 * @param row Row from the server.
 * @param error Error from the last request, if any.
 * @returns HTML for the state cell.
 */
function stateHtml(row, error) {
  // A running job replaces the plain state.
  const job = row.job;
  if (job?.state === "running") {
    return `<span class="spinner"></span>${escapeHtml(job.action)}: ${escapeHtml(job.step)} <span class="meta">${Math.round((Date.now() - job.startedAt) / 1000)}s</span>`;
  }

  // Otherwise the stage, its link, and the last outcome.
  const open = row.stackUrl ? ` <a href="${escapeHtml(row.stackUrl)}" target="_blank">open</a>` : "";
  const state = !row.worktree && row.kind !== "other" ? `<span class="meta">no worktree</span>`
    : row.state === "running" ? `<span class="ok">● running</span>${open}`
    : row.state === "degraded" ? `<span class="warn">not answering</span>${open}`
    : `<span class="meta">${row.kind === "trunk" ? "stopped" : "worktree ready · stopped"}</span>`;
  const outcome = job?.state === "failed" ? `<p class="error">${escapeHtml(job.action)} failed: ${escapeHtml(job.error)}</p>`
    : job?.state === "done" ? `<div class="meta">${escapeHtml(job.action)} finished ${escapeHtml(ago(job.finishedAt))}</div>` : "";
  return `${state}${outcome}${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}`;
}



/**
 * Renders one button with its action.
 *
 * Purpose: Keep every row button the same shape.
 *
 * @param act Action name sent to the server.
 * @param label Visible text.
 * @param busy Disabled attribute while a job runs.
 * @param extra Extra class names, such as primary.
 * @returns HTML for the button.
 */
function button(act, label, busy, extra = "") {
  // Classes style primary and quiet buttons.
  return `<button data-act="${act}" class="${extra}"${busy}>${label}</button>`;
}



/**
 * Renders the buttons a row's stage allows.
 *
 * Purpose: Create first; then start, stop, or remove.
 *
 * @param row Row from the server.
 * @param stacks Whether the project runs stacks.
 * @returns HTML for the action buttons.
 */
function actionsHtml(row, stacks) {
  // Rows that cannot run say why instead.
  const busy = row.job?.state === "running" ? " disabled" : "";
  if (row.conflict) return `<span class="warn">conflicts with the trunk</span>`;
  if (!row.instance) return `<span class="meta">name too long for a worktree</span>`;
  if (!row.worktree && row.kind !== "other") return button("worktree", "Create worktree", busy, "primary");

  // Stopped rows start; running rows stop. Stacks are optional.
  const up = row.state !== "stopped";
  const buttons = [
    stacks && (!up || row.state === "degraded") && row.kind !== "other" && button("start", "Start", busy, up ? "" : "primary"),
    stacks && row.state === "running" && row.kind === "pr" && button("start", "Refresh", busy),
    up && button("stop", "Stop", busy),
    !["trunk", "other"].includes(row.kind) && button("remove", "Remove", busy, "ghost"),
  ];
  return buttons.filter(Boolean).join("") + previewHtml(row, busy);
}



/**
 * Renders the command center preview controls of a PR.
 *
 * Purpose: Open or stop a second command center.
 *
 * @param row Row from the server.
 * @param busy Disabled attribute while a job runs.
 * @returns HTML, empty for rows without a preview.
 */
function previewHtml(row, busy) {
  // Only PRs that change tools/command-center qualify.
  if (!row.commandCenter || row.conflict) return "";
  if (!row.preview) return button("preview", "Preview command center", busy, "ghost");
  return `<a href="${escapeHtml(row.preview.url)}" target="_blank">Open preview</a>${button("unpreview", "Stop preview", busy, "ghost")}`;
}



/**
 * Renders one row, with its confirm strip when asked.
 *
 * Purpose: Keep a row's title, state, and buttons together.
 *
 * @param row Row from the server.
 * @param view Confirm question, request errors, stacks flag.
 * @returns HTML list item.
 */
export function rowHtml(row, view) {
  // The confirm strip sits inside its row.
  const link = row.url ? `<a href="${escapeHtml(row.url)}" target="_blank">${escapeHtml(row.label)}</a> ` : "";
  const notes = [branchNote(row), row.draft && "draft", row.commandCenter && "changes the command center", row.worker && `worker ${row.worker} running`].filter(Boolean);
  const ask = view.confirming?.id === row.id ? view.confirming : null;
  const confirm = ask ? `<div class="confirm">${escapeHtml(ask.text)} ${button(`${ask.act}-confirm`, CONFIRM_LABELS[ask.act], "")}${button("cancel", "Cancel", "", "ghost")}</div>` : "";
  return `<li class="status-row ${escapeHtml(row.state ?? "")}" data-id="${escapeHtml(row.id)}">
    <div class="what">${link}${escapeHtml(row.title)}<div class="meta">${escapeHtml(notes.join(" · "))}</div></div>
    <div class="where">${stateHtml(row, view.errors[row.id])}</div>
    <div class="actions">${actionsHtml(row, view.stacks)}</div>${confirm}</li>`;
}
