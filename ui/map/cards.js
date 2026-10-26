// Writes HTML for Map nodes: questions, decisions, and work cards.
// Markup only; render.js owns open state and clicks.

import { escapeHtml } from "../panels.js";
import { childTitle, plainText, shortDecision } from "./model.js";

/** Plain words for each status, shown on hover. */
export const STATUS_WORDS = { working: "in progress", review: "in review", todo: "to do", blocked: "blocked", done: "done" };

/** What ticking each work type approves, shown on hover. */
const TYPE_HINTS = {
  feature: "Code: new or improved behavior; ends in a PR",
  bug: "Code: fixes broken behavior; ends in a PR",
  chore: "Code: cleanup, removal, or tooling; ends in a PR",
  research: "Report only: no code changes",
  ops: "Changes running services with their CLIs; no app code",
};



/**
 * Tags an issue with its type label.
 *
 * Purpose: Show what ticking an issue approves.
 *
 * @param labels Label names, or nothing.
 * @returns HTML tag, empty without a type label.
 */
export function typeTag(labels) {
  // One type per work issue; parents and questions have none.
  const type = (labels ?? []).find((name) => name.startsWith("type:"))?.slice(5);
  return type ? `<span class="tag type ${escapeHtml(type)}" title="${escapeHtml(TYPE_HINTS[type] ?? type)}">${escapeHtml(type)}</span>` : "";
}



/**
 * Links to an issue on GitHub.
 *
 * Purpose: Keep every issue number clickable the same way.
 *
 * @param node Issue node with number and url.
 * @returns HTML anchor.
 */
function issueLink(node) {
  // New tab, so the command center stays open.
  return `<a class="num" href="${escapeHtml(node.url)}" target="_blank">#${node.number}</a>`;
}



/**
 * Shows pull requests and the owner's review flag.
 *
 * Purpose: Say what an issue produced and who must look.
 *
 * @param node Issue node with prs and labels.
 * @returns HTML chips, possibly empty.
 */
function chips(node) {
  // Pull requests, the review flag, then open blockers.
  const prs = node.prs.map((pr) => `<a class="tag pr ${pr.state}" href="${escapeHtml(pr.url)}" target="_blank" title="${pr.state.toLowerCase()}">PR #${pr.number}</a>`);
  const review = node.labels.includes("needs-human-review") ? ['<span class="tag you" title="Waits for you">needs you</span>'] : [];
  const blockers = (node.blockedBy ?? []).map((number) => `<a class="tag blocked" href="${escapeHtml(node.url.replace(/\d+$/, number))}" target="_blank" title="Blocked by #${number} on GitHub">after #${number}</a>`);
  return [typeTag(node.labels), ...prs, ...review, ...blockers].join("");
}



/**
 * Marks a shipped question as a decided choice.
 *
 * Purpose: Tell decisions apart from work in the folded history.
 *
 * @param node Issue node with a kind.
 * @returns HTML tag, empty for other kinds.
 */
function decidedTag(node) {
  // Only closed questions count as decided.
  return node.kind === "question" ? '<span class="tag">decided</span>' : "";
}



/**
 * Draws an open decision question.
 *
 * Purpose: Put the owner's pending choices where he looks first.
 *
 * @param question Question issue node.
 * @returns HTML node linking to GitHub.
 */
export function questionNode(question) {
  // The whole node opens the issue for answering.
  return `<a class="node question" data-key="q:${question.number}" href="${escapeHtml(question.url)}" target="_blank" title="Answer with a Decision: line in GitHub">
    <span class="mark">?</span><span class="label">${escapeHtml(question.title)}</span><span class="num">#${question.number}</span></a>`;
}



/**
 * Draws one accepted decision, optionally expanded.
 *
 * Purpose: Show a short label that opens to full text.
 *
 * @param decision Register decision.
 * @param open Whether the full text is shown.
 * @returns HTML node, grayed when the decision is folded history.
 */
export function decisionNode(decision, open) {
  // Expanded nodes add the decision and its consequence.
  const detail = open ? `<div class="detail">${escapeHtml(plainText(decision.text))}<div class="meta">→ ${escapeHtml(plainText(decision.consequence))}</div></div>` : "";
  return `<div class="node decision${decision.folded ? " folded" : ""}${open ? " open" : ""}" data-key="d:${decision.id}" data-action="toggle" data-toggle="d:${decision.id}">
    <span class="mark">${decision.id}</span><span class="label">${escapeHtml(shortDecision(decision.text))}</span>${detail}</div>`;
}



/**
 * Draws one child row inside an open goal.
 *
 * Purpose: List a goal's parts with status and output.
 *
 * @param child Child node with status.
 * @returns HTML list item.
 */
function childRow(child) {
  // Dot, short title, number, then chips.
  return `<li data-anchor="${child.number}" title="${STATUS_WORDS[child.status]}"><span class="sdot ${child.status}"></span>
    <span class="label">${escapeHtml(childTitle(child.title))}</span>${issueLink(child)}${chips(child)}</li>`;
}



/**
 * Draws a goal card with progress, or a single-issue card.
 *
 * Purpose: Show progress at a glance and parts on demand.
 *
 * @param card Work card from the view model.
 * @param open Whether a goal's parts are listed.
 * @returns HTML card.
 */
export function workCard(card, open) {
  // Folded history is grayed but drawn the same way.
  const folded = card.folded ? " folded" : "";

  // Single issues are one line with a status dot.
  if (!card.children.length) {
    return `<div class="card${folded}" data-key="i:${card.number}" title="${STATUS_WORDS[card.status]}"><div class="card-head">
      <span class="sdot ${card.status}"></span><span class="title">${escapeHtml(card.title)}</span>${issueLink(card)}${decidedTag(card)}${chips(card)}</div></div>`;
  }

  // Goals show one segment per part and expand on click.
  const segments = card.children.map((child) => `<span class="seg ${child.status}" title="#${child.number} ${escapeHtml(childTitle(child.title))}: ${STATUS_WORDS[child.status]}"></span>`).join("");
  const parts = open ? `<ul class="children">${card.children.map(childRow).join("")}</ul>` : "";
  return `<div class="card goal${folded}${open ? " open" : ""}" data-key="i:${card.number}">
    <div class="card-head" data-action="toggle" data-toggle="i:${card.number}"><span class="chev">${open ? "▾" : "▸"}</span>
      <span class="title">${escapeHtml(card.title)}</span>${issueLink(card)}${chips(card)}<span class="count">${card.done}/${card.children.length}</span></div>
    <div class="segments">${segments}</div>${parts}</div>`;
}
