// Connects to the command center and shows live, typeable terminals.
// Owns browser state, the session list, and the terminal view.

import { kickoff, loadProject, showTab, startWorker } from "./actions.js";
import { updateHome } from "./home/render.js";
import { byId, renderFeed, renderUsage } from "./panels.js";
import { cleanSessions, renderSessionActions } from "./sessions/controls.js";
import { sessionItems } from "./sessions/list.js";
import { cancelQueued, queueItems } from "./sessions/queue.js";
import { openTerminal, refreshTerminal, terminal } from "./sessions/terminal.js";
import { showCurrentVersion } from "./versions/controls.js";

/** Browser state: sessions, events, queue, and what is selected. */
const state = { sessions: [], events: [], usage: null, queue: [], selected: "assistant", socket: null };



/**
 * Sends a message over the socket when it is open.
 *
 * Purpose: Ignore input while reconnecting instead of throwing.
 *
 * @param message Object to send as JSON.
 * @returns No value.
 */
function send(message) {
  // Drop messages while the socket is down.
  if (state.socket?.readyState === WebSocket.OPEN) state.socket.send(JSON.stringify(message));
}



/**
 * Renders the session list, the queue, and the kickoff banner.
 *
 * Purpose: Show every session, what it does, and what waits.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
function renderSessions() {
  // States come from the server's hook-based turn tracking.
  byId("session-list").innerHTML = sessionItems(state.sessions, state.selected, state.usage?.shares ?? {});
  byId("queue-list").innerHTML = queueItems(state.queue);
  byId("terminal-title").textContent = state.selected;
  renderSessionActions(state.sessions, state.selected);

  // Offer the first prompt only while the assistant is untouched.
  const selected = state.sessions.find((session) => session.name === state.selected);
  const offer = selected?.kind === "assistant" && selected.alive && !selected.typed;
  byId("kickoff").classList.toggle("hidden", !offer);
}



/**
 * Shows one session in the terminal.
 *
 * Purpose: Switch the terminal to another session.
 *
 * @param name Session name.
 * @returns No value.
 */
function attach(name) {
  // Render first: the kickoff banner changes the terminal's size.
  state.selected = name;
  renderSessions();
  refreshTerminal();
  renderFeed(byId("feed"), state.events, state.sessions, byId("feed-all").checked ? null : name);
}



/**
 * Applies one server message to the page.
 *
 * Purpose: Keep sessions, output, feed, and usage live.
 *
 * @param message Parsed server message.
 * @returns No value.
 */
function handle(message) {
  // A screen resets and redraws; output continues it.
  const shown = message.type === "screen" || message.type === "output";
  if (shown && message.name === state.selected) return terminal.write(message.data);
  if (message.type === "hello") Object.assign(state, { sessions: message.sessions, events: message.events, usage: message.usage, queue: message.queue ?? [] });
  if (message.type === "sessions") state.sessions = message.sessions;
  if (message.type === "queue") state.queue = message.queue;
  if (message.type === "event") state.events = [...state.events.slice(-1999), message.event];
  if (message.type === "usage") state.usage = message.usage;
  renderSessions();
  renderUsage(byId("usage"), state.usage);
  renderFeed(byId("feed"), state.events, state.sessions, byId("feed-all").checked ? null : state.selected);
  drawHome();
  if (message.type === "hello") showCurrentVersion(byId("version"));
  if (message.type === "hello" || message.type === "sessions") loadProject();
  if (message.type === "hello") attach(state.sessions.some((item) => item.name === state.selected) ? state.selected : state.sessions[0]?.name ?? "assistant");
}



/**
 * Opens the socket and reconnects when it drops.
 *
 * Purpose: Survive server restarts without a page reload.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
function connect() {
  // Show connection state in the header pill.
  const pill = byId("connection");
  state.socket = new WebSocket(`ws://${location.host}/ws`);
  state.socket.onopen = () => { pill.textContent = "live"; pill.className = "pill ok"; };
  state.socket.onmessage = (raw) => handle(JSON.parse(raw.data));
  state.socket.onclose = () => {
    // Retry until the server is back.
    pill.textContent = "reconnecting…";
    pill.className = "pill";
    setTimeout(connect, 1500);
  };
}



/**
 * Redraws Home with the current state.
 *
 * Purpose: Keep Home live; it skips work while hidden.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
function drawHome() {
  // Home throttles itself and fetches GitHub data.
  updateHome(byId("home"), state, openSession);
}



/**
 * Opens one session's terminal from another tab.
 *
 * Purpose: Let Home cards jump to a session.
 *
 * @param name Session name.
 * @returns No value.
 */
function openSession(name) {
  // Show the pane first so the terminal can size itself.
  showTab("sessions", state.sessions);
  attach(name);
}



// Wire the terminal, controls, and connection.
openTerminal(byId("terminal"), (size) => send({ type: "attach", name: state.selected, ...size }), (data) => send({ type: "input", name: state.selected, data }));
byId("session-list").addEventListener("click", (event) => { const item = event.target.closest("li[data-name]"); if (item) attach(item.dataset.name); });
byId("stop-session").addEventListener("click", () => fetch(`/api/stop/${encodeURIComponent(state.selected)}`, { method: "POST" }));
byId("clean-sessions").addEventListener("click", () => cleanSessions(state.sessions, state.selected, attach));
byId("queue-list").addEventListener("click", (event) => { const id = event.target.dataset.cancel; if (id) cancelQueued(id); });
byId("feed-all").addEventListener("change", () => renderFeed(byId("feed"), state.events, state.sessions, byId("feed-all").checked ? null : state.selected));
byId("worker-form").addEventListener("submit", (event) => startWorker(event, attach));
byId("version").addEventListener("click", () => showTab("versions", state.sessions));
byId("kickoff-button").addEventListener("click", (event) => kickoff(event.target).then(() => terminal.focus()));
for (const button of document.querySelectorAll("nav button")) button.addEventListener("click", () => showTab(button.dataset.tab, state.sessions).then(drawHome));
setInterval(renderSessions, 3000);
connect();
