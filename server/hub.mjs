// Streams terminals, activity, and usage to browsers over WebSocket.
// Each browser watches, sizes, and types into one terminal.

import { WebSocketServer } from "ws";
import { recentEvents, readUsage, watchEvents } from "./data/feed.mjs";
import { listQueue, onQueueChange } from "./queue/store.mjs";
import { noteEvent } from "./sessions/activity.mjs";
import { writeInput } from "./sessions/input.mjs";
import { screenSnapshot } from "./sessions/screen/mirror.mjs";
import { announceSessions, listSessions, onSessionEvent, requireSession } from "./sessions/terminals.mjs";
import { advanceShares, emptyShareState, sharesBySession } from "./usage/share-split.mjs";



/**
 * Sends one message to every connected browser.
 *
 * Purpose: Fan out list changes, events, and usage.
 *
 * @param hub WebSocket server.
 * @param message Message object to serialize.
 * @returns No value.
 */
function broadcast(hub, message) {
  // Serialize once for all clients.
  const text = JSON.stringify(message);
  for (const client of hub.clients) client.send(text);
}



/** Limit shares per session, kept in memory. */
let shareState = emptyShareState();



/**
 * Reads plan usage, per-session stats, and limit shares.
 *
 * Purpose: Keep usage payloads identical everywhere.
 *
 * Inputs: None.
 *
 * @returns Plan windows, per-session stats, and shares by session id.
 */
function currentUsage() {
  // Session ids come from the ids we assigned at launch.
  const sessionIds = listSessions().map((item) => item.meta.sessionId).filter(Boolean);
  const usage = readUsage(sessionIds);

  // Advance the split with each session's total spend so far.
  const costs = Object.fromEntries(sessionIds.map((id) => [id, usage.sessions[id]?.cost?.total_cost_usd]).filter(([, cost]) => typeof cost === "number"));
  shareState = advanceShares(shareState, usage.plan, costs);
  return { ...usage, shares: sharesBySession(shareState, sessionIds) };
}



/** Largest terminal side a browser may ask for. */
const MAX_SIDE = 1000;



/**
 * Checks one side of a requested terminal size.
 *
 * Purpose: Never pass a bad size to node-pty.
 *
 * @param value Requested columns or rows.
 * @returns Whether the value is usable.
 */
function usableSide(value) {
  // Whole, positive, and within reason.
  return Number.isInteger(value) && value > 0 && value <= MAX_SIDE;
}



/**
 * Sizes a session for one browser and sends its screen.
 *
 * Purpose: Redraw cleanly after switches, resizes, and refocus.
 *
 * @param socket Browser connection.
 * @param session Session to show.
 * @param size Browser terminal columns and rows.
 * @returns No value.
 *
 * Side effects: Resizes the session, so Claude redraws.
 */
function showScreen(socket, session, { cols, rows }) {
  // Ended sessions keep their last size.
  if (session.alive && usableSide(cols) && usableSide(rows)) {
    session.terminal.resize(cols, rows);
    session.screen.resize(cols, rows);
  }

  // Hold live output until the snapshot is out.
  const held = [];
  Object.assign(socket, { attached: session.name, held });
  screenSnapshot(session.screen).catch(() => "").then((data) => {
    // A newer attach replaced this one and sends its own.
    if (socket.held !== held) return;
    socket.held = null;
    socket.send(JSON.stringify({ type: "screen", name: session.name, data }));
    for (const text of held) socket.send(text);
  });
}



/**
 * Sends session output to one browser, or holds it.
 *
 * Purpose: Keep output after a pending snapshot in order.
 *
 * @param socket Browser connection watching the session.
 * @param text Serialized output message.
 * @returns No value.
 */
function deliver(socket, text) {
  // The pending snapshot covers everything before the hold.
  if (socket.held) socket.held.push(text);
  else socket.send(text);
}



/**
 * Applies one browser message to its session.
 *
 * Purpose: Attach at the browser's size, and type.
 *
 * @param socket Browser connection.
 * @param raw Raw message text.
 * @returns No value.
 */
function handleMessage(socket, raw) {
  // Malformed or stale messages are ignored; the UI recovers.
  try {
    const message = JSON.parse(raw);
    const session = requireSession(message.name);
    if (message.type === "attach") showScreen(socket, session, message);
    if (message.type === "input") writeInput(message.name, message.data);
  } catch {
    // Nothing to do for unusable input.
  }
}



/**
 * Attaches the WebSocket hub to the HTTP server.
 *
 * Purpose: Stream sessions, activity, and usage live.
 *
 * @param server HTTP server to share.
 * @returns No value.
 */
export function attachHub(server) {
  // Push hook events, usage, queue, and session changes live.
  const hub = new WebSocketServer({ server, path: "/ws" });
  watchEvents((event) => {
    // Events also move sessions between working and idle.
    if (noteEvent(event, listSessions())) announceSessions();
    broadcast(hub, { type: "event", event });
  });
  onQueueChange(() => broadcast(hub, { type: "queue", queue: listQueue() }));
  setInterval(() => broadcast(hub, { type: "usage", usage: currentUsage() }), 5000);
  setInterval(announceSessions, 10_000);
  onSessionEvent((event) => {
    // List changes go to everyone; output only to its viewers.
    if (event.type === "sessions") return broadcast(hub, { type: "sessions", sessions: listSessions() });
    const text = JSON.stringify(event);
    for (const client of hub.clients) if (client.attached === event.name) deliver(client, text);
  });

  // Greet each browser with the current picture.
  hub.on("connection", (socket) => {
    socket.send(JSON.stringify({ type: "hello", sessions: listSessions(), events: recentEvents(), usage: currentUsage(), queue: listQueue() }));
    socket.on("message", (raw) => handleMessage(socket, raw));
  });
}
