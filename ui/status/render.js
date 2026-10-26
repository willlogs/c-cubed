// Draws the Status tab: trunk, pull requests, issues, worktrees.
// Pure rendering; controls.js fetches data and handles buttons.

import { escapeHtml } from "../panels.js";
import { ago, rowHtml } from "./rows.js";

/** Sections in order, with text for when empty. */
const SECTIONS = [
  { key: "trunk", title: "Trunk", empty: "" },
  { key: "prs", title: "Pull requests", empty: "No open pull requests." },
  { key: "issues", title: "Issues", empty: "No open issues." },
  { key: "worktrees", title: "Other worktrees", empty: "" },
];



/**
 * Renders the whole Status tab.
 *
 * Purpose: One clean list of open work and stacks.
 *
 * @param element Status container.
 * @param data Payload from /api/stacks.
 * @param view Confirm question, request errors, and load error.
 * @returns No value.
 */
export function renderStacks(element, data, view) {
  // Header, sections, then rowless stacks.
  const { capacity, github } = data;
  view.stacks = capacity.configured;
  const stacks = capacity.configured ? `${capacity.running} of ${capacity.max} stacks running` : "Worktrees only: this project runs no stacks";
  const errors = [view.loadError, github.error].filter(Boolean).map((text) => `<p class="error">${escapeHtml(text)}</p>`).join("");
  element.innerHTML = `<div class="status">
    <div class="status-head"><span>${stacks} · GitHub ${escapeHtml(ago(github.at))}</span>
      <button class="ghost" data-act="refresh">Refresh</button></div>
    ${errors}${SECTIONS.map((section) => sectionHtml(section, data, view)).join("")}${othersHtml(data, view)}</div>`;
}



/**
 * Renders one section of rows.
 *
 * Purpose: Group rows so each kind is easy to find.
 *
 * @param section Key, title, and empty text.
 * @param data Payload with every row.
 * @param view Confirm and error state.
 * @returns HTML, or nothing for an empty optional section.
 */
function sectionHtml(section, data, view) {
  // Optional sections disappear when empty.
  const rows = data.rows.filter((row) => row.section === section.key);
  if (!rows.length && !section.empty) return "";
  const body = rows.length ? rows.map((row) => rowHtml(row, view)).join("") : `<li class="empty">${section.empty}</li>`;
  const count = section.key === "trunk" ? "" : ` <span class="count">${rows.length}</span>`;
  return `<section class="status-section"><h3>${section.title}${count}</h3><ul class="status-rows">${body}</ul></section>`;
}



/**
 * Lists stacks and previews that no row covers.
 *
 * Purpose: Keep a merged PR's or worker's stack stoppable.
 *
 * @param data Payload with others and strayPreviews.
 * @param view Confirm and error state.
 * @returns HTML section, or nothing when empty.
 */
function othersHtml(data, view) {
  // Workers' own stacks often land here.
  const stacks = data.others.map((item) => rowHtml({ ...item, kind: "other", title: item.name, instance: item.name }, view));
  const previews = data.strayPreviews.map((item) => `<li class="status-row" data-id="${escapeHtml(item.id)}"><div class="what">${escapeHtml(item.id)} preview</div>
    <div class="where"></div><div class="actions"><a href="${escapeHtml(item.url)}" target="_blank">Open preview</a><button data-act="unpreview" class="ghost">Stop preview</button></div></li>`);
  if (!stacks.length && !previews.length) return "";
  return `<section class="status-section"><h3>Other stacks</h3><ul class="status-rows">${[...stacks, ...previews].join("")}</ul></section>`;
}
