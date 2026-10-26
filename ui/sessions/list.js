// Renders the sidebar's session list from the server's turn states.
// Pure rendering: app.js owns state, selection, and the connection.

import { escapeHtml } from "../panels.js";

/** Dot color for each turn state. */
const DOTS = { working: "working", waiting: "input", starting: "starting" };

/** Words for each turn state on a session card. */
const WORDS = { working: "working", waiting: "needs you", starting: "starting", idle: "idle" };



/**
 * Formats how long ago a time was.
 *
 * Purpose: Keep durations short on cards and queue rows.
 *
 * @param time Epoch milliseconds.
 * @returns Text like 40s, 4m, or 2h.
 */
export function ago(time) {
  // Seconds under a minute, then minutes, then hours.
  const seconds = Math.max(0, Math.round((Date.now() - (time ?? Date.now())) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return seconds < 3600 ? `${Math.round(seconds / 60)}m` : `${Math.round(seconds / 3600)}h`;
}



/**
 * Formats a session's share of the 5h and weekly limits.
 *
 * Purpose: Show cost as limit share, not dollars.
 *
 * @param share Percentage points per window, or undefined.
 * @returns Text like " · 5h +1.4%", or empty.
 */
function shareLabel(share) {
  // Only windows the plan file reported are shown.
  const parts = [["five_hour", "5h"], ["seven_day", "7d"]]
    .filter(([name]) => typeof share?.[name] === "number")
    .map(([name, label]) => `${label} +${share[name].toFixed(1)}%`);
  return parts.map((part) => ` · ${part}`).join("");
}



/**
 * Describes a session's state for its card.
 *
 * Purpose: Say what it does and for how long.
 *
 * @param session Session summary with its turn.
 * @returns Dot class and words such as "working 3m".
 */
export function stateOf(session) {
  // Ended sessions show their exit instead.
  if (!session.alive) return { dot: "exited", words: `ended ${ago(session.endedAt)} ago` };
  const turn = session.turn ?? { state: "idle", since: session.startedAt };
  return { dot: DOTS[turn.state] ?? "", words: `${WORDS[turn.state] ?? turn.state} ${ago(turn.since)}` };
}



/**
 * Renders every session as a sidebar item.
 *
 * Purpose: Show who runs, what each does, and its cost.
 *
 * @param sessions Session summaries from the server.
 * @param selected Name of the session in the terminal.
 * @param shares Limit shares keyed by session id.
 * @returns HTML for the session list.
 */
export function sessionItems(sessions, selected, shares) {
  // Each item shows state, role or model, issue, and share.
  return sessions.map((session) => {
    // Classes mark the selected and ended sessions.
    const { dot, words } = stateOf(session);
    const issue = session.meta.issue ? ` · #${session.meta.issue}` : "";
    const role = session.kind === "worker" ? session.meta.model : `${session.kind} · ${session.meta.model}`;
    const classes = `${session.name === selected ? "selected" : ""} ${session.alive ? "" : "ended"}`;
    return `<li data-name="${escapeHtml(session.name)}" class="${classes}">
      <div class="name"><span class="dot ${dot}"></span>${escapeHtml(session.name)}</div>
      <div class="meta">${escapeHtml(role)}${issue}${shareLabel(shares[session.meta.sessionId])} · ${escapeHtml(words)}</div></li>`;
  }).join("") || "<li>No sessions yet</li>";
}
