// Renders the message queue and cancels waiting messages.
// Messages wait for a finished turn and an empty box.

import { escapeHtml } from "../panels.js";
import { ago } from "./list.js";

/** Finished messages kept visible under the waiting ones. */
const RECENT = 3;

/** Why a message waits, by the server's hold reason. */
const HOLDS = {
  working: "{to} is working",
  starting: "{to} is starting",
  waiting: "{to} needs you",
  settling: "{to} just finished",
  typing: "you are typing in {to}",
  draft: "your draft in {to}",
};



/**
 * Renders one queue row.
 *
 * Purpose: Show sender, target, age, and the text's start.
 *
 * @param item Queue item from the server.
 * @returns HTML for one list item.
 */
function queueRow(item) {
  // Waiting rows get a Cancel button and why they wait.
  const waiting = item.state === "waiting";
  const action = waiting ? `<button class="ghost" data-cancel="${item.id}">Cancel</button>` : `<span class="state">${escapeHtml(item.state)}</span>`;
  const hold = waiting && HOLDS[item.hold] ? `<div class="hold">held: ${escapeHtml(HOLDS[item.hold].replace("{to}", item.to))}</div>` : "";
  return `<li class="${waiting ? "waiting" : "done"}" title="${escapeHtml(item.text)}">
    <div class="route">#${item.id} ${escapeHtml(item.from)} → ${escapeHtml(item.to)} · ${ago(item.doneAt ?? item.createdAt)}${action}</div>
    <div class="text">${escapeHtml(item.text)}</div>${hold}</li>`;
}



/**
 * Renders waiting messages and the latest finished ones.
 *
 * Purpose: Let the owner see and retract waiting messages.
 *
 * @param queue Queue items from the server, oldest first.
 * @returns HTML for the queue list.
 */
export function queueItems(queue) {
  // Waiting first, then a few recent deliveries.
  const waiting = queue.filter((item) => item.state === "waiting");
  const recent = queue.filter((item) => item.state !== "waiting").slice(-RECENT).reverse();
  const rows = [...waiting, ...recent].map(queueRow).join("");
  return rows || `<li class="empty">Nothing waiting</li>`;
}



/**
 * Cancels a waiting message.
 *
 * Purpose: Back the queue's Cancel buttons.
 *
 * @param id Message id.
 * @returns Promise resolving when the server answers.
 */
export async function cancelQueued(id) {
  // The server refuses messages already delivered.
  await fetch(`/api/cancel/${encodeURIComponent(id)}`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
}
