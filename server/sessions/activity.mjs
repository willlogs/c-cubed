// Tracks whether each session is mid-turn or between turns.
// Hook events and submitted input drive it, not terminal output.

import { PORT } from "./env.mjs";

/** Time a fresh session gets to report its start. */
const START_GRACE_MS = 20_000;

/** Turn timestamps per session name. */
const turns = new Map();



/**
 * Returns a session's turn record, creating it once.
 *
 * Purpose: Keep every timestamp in one place per session.
 *
 * @param name Session name.
 * @returns Mutable record of turn timestamps.
 */
function turnOf(name) {
  // Zero means the moment has not happened yet.
  if (!turns.has(name)) turns.set(name, { readyAt: 0, promptAt: 0, toolAt: 0, stopAt: 0, waitingAt: 0, turnAt: 0 });
  return turns.get(name);
}



/**
 * Records activity and notes when a new turn starts.
 *
 * Purpose: Know how long the current turn has run.
 *
 * @param turn Turn record to update.
 * @param field Timestamp field: promptAt or toolAt.
 * @param at Time of the activity.
 * @returns No value.
 */
function markBusy(turn, field, at) {
  // Activity after a stop opens a new turn.
  if (Math.max(turn.promptAt, turn.toolAt) <= turn.stopAt) turn.turnAt = at;
  turn[field] = Math.max(turn[field], at);
}



/**
 * Starts a fresh record for a new or restarted session.
 *
 * Purpose: Drop timestamps from an earlier session with this name.
 *
 * @param name Session name.
 * @param busy Whether it starts working on a prompt.
 * @returns No value.
 */
export function resetTurn(name, busy = false) {
  // Workers start with their briefing as the first prompt.
  turns.delete(name);
  if (busy) markBusy(turnOf(name), "promptAt", Date.now());
}



/**
 * Records that someone submitted input to a session.
 *
 * Purpose: Count a typed or delivered message as work starting.
 *
 * @param name Session name.
 * @returns No value.
 */
export function notePrompt(name) {
  // Enter starts or continues a turn.
  markBusy(turnOf(name), "promptAt", Date.now());
}



/**
 * Finds which of our sessions a hook event came from.
 *
 * Purpose: Ignore events from other command centers and terminals.
 *
 * @param event Hook event from the activity feed.
 * @param sessions Session summaries with their launch ids.
 * @returns Session name, or null when it is not ours.
 */
export function eventSession(event, sessions) {
  // Our sessions stamp their name and port into events.
  if (event.name) return String(event.port) === String(PORT) ? event.name : null;
  return sessions.find((session) => session.meta?.sessionId === event.session)?.name ?? null;
}



/**
 * Updates a session's turn from one hook event.
 *
 * Purpose: Learn when turns end and permission prompts appear.
 *
 * @param event Hook event from the activity feed.
 * @param sessions Session summaries with their launch ids.
 * @returns Name of the session whose state changed, or null.
 */
export function noteEvent(event, sessions) {
  // Only events from our own sessions count.
  const name = eventSession(event, sessions);
  const session = sessions.find((item) => item.name === name);
  if (!session) return null;
  const before = describeTurn(session).state;

  // Each event kind moves one timestamp.
  const turn = turnOf(name);
  const at = Date.parse(event.at) || Date.now();
  if (event.event === "SessionStart") turn.readyAt = at;
  else if (event.event === "Stop") turn.stopAt = at;
  else if (event.event === "UserPromptSubmit") markBusy(turn, "promptAt", at);
  else if (event.event === "Notification") turn.waitingAt = isPermissionPrompt(event) ? at : turn.waitingAt;
  else markBusy(turn, "toolAt", at);
  return describeTurn(session).state === before ? null : name;
}



/**
 * Tells whether a notification is a permission prompt.
 *
 * Purpose: Never type a message into a permission dialog.
 *
 * @param event Notification hook event.
 * @returns True when the session waits for a permission answer.
 */
function isPermissionPrompt(event) {
  // Older recorders only kept the message text.
  return event.notification === "permission_prompt" || /permission/i.test(event.detail ?? "");
}



/**
 * Describes what a session is doing and since when.
 *
 * Purpose: Give the queue, CLI, and page one state.
 *
 * @param session Live session record or summary.
 * @returns State (starting, working, waiting, idle, ended) and since.
 */
export function describeTurn(session) {
  // Ended and just-started sessions come first.
  if (!session.alive) return { state: "ended", since: session.endedAt };
  const turn = turnOf(session.name);
  if (!turn.readyAt && Date.now() - session.startedAt < START_GRACE_MS) return { state: "starting", since: session.startedAt };

  // A permission prompt outranks both busy and idle.
  const busyAt = Math.max(turn.promptAt, turn.toolAt);
  if (turn.waitingAt > turn.stopAt && turn.waitingAt >= busyAt) return { state: "waiting", since: turn.waitingAt };
  if (busyAt > turn.stopAt) return { state: "working", since: turn.turnAt || busyAt };
  return { state: "idle", since: turn.stopAt || session.startedAt };
}
