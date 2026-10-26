// Writes the Today panel's HTML: groups, items, and their reasons.
// Markup only; render.js owns open state, clicks, and hover.

import { escapeHtml, project } from "../../panels.js";
import { typeTag } from "../cards.js";
import { plainText, shortDecision } from "../model.js";
import { tickBox } from "./tick.js";

/** Group headings as the owner reads them. */
const TITLES = { needs: "Needs you", progress: "In progress", next: "Up next", done: "Done today" };

/** Decisions named on an item's folded reason line. */
const FOLDED_DECISIONS = 2;



/**
 * Links to GitHub in a new tab, keyed for hover.
 *
 * Purpose: Keep every link and hover key the same.
 *
 * @param url Target address.
 * @param html Link content, already escaped.
 * @param attributes Extra attributes such as class or data-key.
 * @returns HTML anchor.
 */
function link(url, html, attributes = "") {
  // New tab, so the command center stays open.
  return `<a href="${escapeHtml(url)}" target="_blank" ${attributes}>${html}</a>`;
}



/**
 * Draws a decision with its id and text.
 *
 * Purpose: Hovering it lights the decision in the graph.
 *
 * @param decision Register decision.
 * @param text Decision text to show, plain.
 * @returns HTML span.
 */
function decisionRef(decision, text) {
  // The id stands out; the text explains it.
  return `<span data-key="d:${escapeHtml(decision.id)}"><b>${escapeHtml(decision.id)}</b> ${escapeHtml(text)}</span>`;
}



/**
 * Draws a related issue: linked number, then title.
 *
 * Purpose: Hovering it lights that issue in the graph.
 *
 * @param ref Issue reference from whyOf.
 * @returns HTML text.
 */
function issueRef(ref) {
  // The number links; the title explains it.
  return `${link(ref.url, `#${ref.number}`, `data-key="${ref.key}"`)} ${escapeHtml(ref.title)}`;
}



/**
 * Writes the one-line reason shown while an item is folded.
 *
 * Purpose: Show the why at a glance, in one line.
 *
 * @param why Reasons from whyOf.
 * @returns HTML, or "" when nothing explains the item.
 */
function whyLine(why) {
  // Decisions and the parent first; extra decisions become a count.
  const extra = why.decisions.length - FOLDED_DECISIONS;
  const parts = why.decisions.slice(0, FOLDED_DECISIONS).map((decision) => decisionRef(decision, shortDecision(decision.text)));
  if (extra > 0) parts.push(`+${extra}`);
  if (why.parent) parts.push(`part of #${why.parent.number}`);
  if (why.blockedBy?.length) parts.push(`after ${why.blockedBy.map((ref) => `#${ref.number}`).join(", ")}`);

  // Otherwise the plan note, the owner's words, or mentions.
  if (!parts.length && why.note) parts.push(`“${escapeHtml(plainText(why.note))}”`);
  if (!parts.length && why.quote) parts.push(`${escapeHtml(project.owner)}: ${escapeHtml(why.quote)}`);
  if (!parts.length && why.mentions.length) parts.push(`mentions ${why.mentions.map((ref) => `#${ref.number}`).join(", ")}`);
  return parts.join(" · ");
}



/**
 * Writes every reason for an opened item.
 *
 * Purpose: Show decisions, related issues, plan note, and quote.
 *
 * @param why Reasons from whyOf.
 * @returns HTML definition list.
 */
function whyDetail(why) {
  // One labeled row per kind of reason; skip empty kinds.
  const rows = [
    ["Follows", why.decisions.map((decision) => decisionRef(decision, plainText(decision.text)))],
    ["Part of", why.parent ? [issueRef(why.parent)] : []],
    ["Blocked by", (why.blockedBy ?? []).map(issueRef)],
    ["Mentions", why.mentions.map(issueRef)],
    ["Plan", why.note ? [`${escapeHtml(why.section)}: “${escapeHtml(plainText(why.note))}”`] : []],
    [escapeHtml(project.owner), why.quote ? [escapeHtml(why.quote)] : []],
  ].filter(([, values]) => values.length);
  return `<dl class="why-detail">${rows.map(([label, values]) => `<dt>${label}</dt><dd>${values.join("<br>")}</dd>`).join("")}</dl>`;
}



/**
 * Draws one item: status, linked title, and its reasons.
 *
 * Purpose: Say what it is, where it stands, and why.
 *
 * @param item Drawable item from buildToday.
 * @param open Whether the reasons are listed in full.
 * @returns HTML list item.
 */
function itemRow(item, open) {
  // The title opens GitHub; the reason line toggles detail.
  const pr = item.openPr ? link(item.openPr.url, `PR #${item.openPr.number}`, `class="tag pr ${escapeHtml(item.openPr.state)}"`) : "";
  const word = item.word ? `<span class="word">${escapeHtml(item.word)}</span>` : "";
  const head = `<div class="today-row">${tickBox(item.line)}<span class="sdot ${item.status}"></span>${link(item.url, escapeHtml(item.title || item.label), 'class="title"')}
    <span class="num">${item.label}</span>${typeTag(item.node?.labels)}${pr}${word}</div>`;

  // Items with no reason at all skip the line.
  const line = whyLine(item.why);
  const why = line && `<div class="why" data-action="toggle" data-toggle="${escapeHtml(item.id)}"><span class="chev">${open ? "▾" : "▸"}</span>
    ${open ? whyDetail(item.why) : `<span class="why-line">${line}</span>`}</div>`;
  return `<li class="today-item" data-key="${item.key}">${head}${why}</li>`;
}



/**
 * Draws done work as one wrapped line of links.
 *
 * Purpose: Keep finished work visible but compact.
 *
 * @param items Done items.
 * @returns HTML block.
 */
function doneList(items) {
  // CSS cuts long titles; the full title shows on hover.
  const chips = items.map((item) => link(item.url, `<b>${item.label}</b> ${escapeHtml(item.title)}`,
    `class="done-item" title="${escapeHtml(item.title)}" data-key="${item.key}"`));
  return `<div class="done-list">${chips.join("")}</div>`;
}



/**
 * Draws one group: a heading with its count, then items.
 *
 * Purpose: Keep done work compact and empty asks explicit.
 *
 * @param group Group name and items.
 * @param open Keys of opened items.
 * @returns HTML block.
 */
function groupBlock(group, open) {
  // Done work is one line; empty "Needs you" says so.
  let body = `<ul>${group.items.map((item) => itemRow(item, open.has(item.id))).join("")}</ul>`;
  if (group.name === "done") body = doneList(group.items);
  if (!group.items.length) body = '<p class="empty">Nothing needs you.</p>';
  return `<div class="today-group ${group.name}"><h4>${TITLES[group.name]} <span class="count">${group.items.length}</span></h4>${body}</div>`;
}



/**
 * Draws the Today panel above the graph.
 *
 * Purpose: Lead the Map with what needs the owner.
 *
 * @param today Plan and groups from buildToday.
 * @param open Keys of opened items.
 * @returns HTML section.
 */
export function todayPanel(today, open) {
  // "Needs you" always shows; other groups only when filled.
  const plan = today.plan ? link(today.plan.url, escapeHtml(today.plan.title)) : '<span class="empty">No open daily plan</span>';
  const groups = today.groups.filter((group) => group.name === "needs" || group.items.length).map((group) => groupBlock(group, open));
  return `<section class="today"><div class="today-head"><h3>Today</h3>${plan}</div>${groups.join("")}</section>`;
}
