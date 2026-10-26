// Runs sessions in pseudo-terminals and mirrors their screens.
// Lets the browser and CLI watch and type into sessions.

import pty from "node-pty";
import { describeTurn, resetTurn } from "./activity.mjs";
import { childEnv, identityEnv } from "./env.mjs";
import { createScreen } from "./screen/mirror.mjs";

/** Live and finished sessions, keyed by name. */
const sessions = new Map();

/** Callbacks notified about output and list changes. */
const listeners = new Set();



/**
 * Subscribes to session output and list changes.
 *
 * Purpose: Let the WebSocket hub mirror sessions to browsers.
 *
 * @param listener Callback receiving output or list events.
 * @returns Function that removes the subscription.
 */
export function onSessionEvent(listener) {
  // Return an unsubscribe handle for closed sockets.
  listeners.add(listener);
  return () => listeners.delete(listener);
}



/**
 * Sends one event to every listener.
 *
 * Purpose: Keep fan-out in one place.
 *
 * @param event Output or list-change event.
 * @returns No value.
 */
function emit(event) {
  // Listeners never break the session that produced output.
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      listeners.delete(listener);
    }
  }
}



/**
 * Starts a named session in a new pseudo-terminal.
 *
 * Purpose: Run master and workers as real interactive terminals.
 *
 * @param spec Name, kind, cwd, command, args, env, meta, busy.
 * @returns The live session record.
 *
 * Side effects: Spawns a child process.
 */
export function startSession({ name, kind, cwd, command, args, env, meta = {}, busy = false }) {
  // Names are identities; finished sessions must be removed first.
  if (sessions.get(name)?.alive) throw new Error(`Session ${name} is already running.`);
  const terminal = pty.spawn(command, args, { name: "xterm-256color", cols: 120, rows: 36, cwd, env: childEnv({ ...identityEnv(name, kind), ...env }) });
  resetTurn(name, busy);
  const screen = createScreen(120, 36);
  const session = { name, kind, cwd, meta, terminal, screen, typed: false, alive: true, exitCode: null, endedAt: null, startedAt: Date.now(), lastOutputAt: Date.now() };

  // Mirror every chunk, then broadcast it.
  terminal.onData((data) => {
    // The mirror is written first; snapshots rely on that order.
    session.screen.write(data);
    session.lastOutputAt = Date.now();
    emit({ type: "output", name, data });
  });
  terminal.onExit(({ exitCode }) => {
    Object.assign(session, { alive: false, exitCode, endedAt: Date.now() });
    emit({ type: "sessions" });
  });
  sessions.set(name, session);
  emit({ type: "sessions" });
  return session;
}



/** List order of live sessions by role; ended ones sink. */
const RANKS = { assistant: 0, master: 1, worker: 2 };



/**
 * Ranks a session for list order.
 *
 * Purpose: Put the assistant and master first, ended sessions last.
 *
 * @param session Session record.
 * @returns Lower numbers sort first.
 */
function sortRank(session) {
  // Ended sessions sink below everything alive.
  return session.alive ? RANKS[session.kind] ?? 2 : 3;
}



/**
 * Lists sessions as plain summaries.
 *
 * Purpose: Feed the sidebar and the CLI without terminal handles.
 *
 * Inputs: None.
 *
 * @returns Control sessions, workers, then ended ones, with turn state.
 */
export function listSessions() {
  // Live sessions first; ended ones by recency.
  return [...sessions.values()]
    .sort((a, b) => sortRank(a) - sortRank(b) || (a.alive ? a.startedAt - b.startedAt : b.endedAt - a.endedAt))
    .map(({ name, kind, cwd, meta, typed, alive, exitCode, startedAt, endedAt, lastOutputAt }) => {
      // The turn says working, waiting, or idle, and since when.
      const summary = { name, kind, cwd, meta, typed, alive, exitCode, startedAt, endedAt, lastOutputAt };
      return { ...summary, turn: describeTurn(summary) };
    });
}



/**
 * Returns one session or fails with a clear message.
 *
 * Purpose: Share lookups between HTTP routes and sockets.
 *
 * @param name Session name.
 * @returns The session record.
 */
export function requireSession(name) {
  // Unknown names are caller errors, reported plainly.
  const session = sessions.get(name);
  if (!session) throw new Error(`No session named ${name}.`);
  return session;
}



/**
 * Stops a session and optionally forgets it.
 *
 * Purpose: End workers and free their names.
 *
 * @param name Session name.
 * @param forget Whether to drop its screen too.
 * @returns No value.
 */
export function stopSession(name, forget = false) {
  // Killing an exited terminal is harmless; forgetting frees the name.
  const session = requireSession(name);
  if (session.alive) session.terminal.kill();
  if (forget) sessions.delete(name);
  emit({ type: "sessions" });
}



/**
 * Notifies listeners that session states changed.
 *
 * Purpose: Let hook events refresh the session list.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
export function announceSessions() {
  // Same event a start or exit sends.
  emit({ type: "sessions" });
}



/**
 * Stops every live session.
 *
 * Purpose: Make Ctrl-C on the server end all work.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
export function stopAll() {
  // Send the terminal hangup to each child.
  for (const session of sessions.values()) if (session.alive) session.terminal.kill();
}
