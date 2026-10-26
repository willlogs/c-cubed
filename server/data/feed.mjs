// Reads the activity feed, plan usage, and per-session stats.
// Hooks and the status line write them from every session.

import fs from "node:fs";
import path from "node:path";
import { STATE_DIR } from "../sessions/env.mjs";

/** One JSON event per line, appended by the hook recorder. */
export const EVENTS_FILE = path.join(STATE_DIR, "events.jsonl");

/** Event log size that triggers trimming at startup. */
const MAX_EVENTS_BYTES = 5_000_000;



/**
 * Parses JSON lines, skipping partial or broken ones.
 *
 * Purpose: Tolerate a hook writing while we read.
 *
 * @param text Raw file text.
 * @returns Parsed events.
 */
function parseLines(text) {
  // Ignore blank and unparseable lines.
  return text.split("\n").flatMap((line) => {
    try {
      return line.trim() ? [JSON.parse(line)] : [];
    } catch {
      return [];
    }
  });
}



/**
 * Returns the most recent events.
 *
 * Purpose: Fill the feed when a browser connects.
 *
 * @param limit Maximum events to return.
 * @returns Newest events, oldest first.
 */
export function recentEvents(limit = 300) {
  // Trim a runaway log, then read its tail.
  if (!fs.existsSync(EVENTS_FILE)) return [];
  const events = parseLines(fs.readFileSync(EVENTS_FILE, "utf8"));
  if (fs.statSync(EVENTS_FILE).size > MAX_EVENTS_BYTES) {
    fs.writeFileSync(EVENTS_FILE, events.slice(-2000).map((event) => JSON.stringify(event)).join("\n") + "\n");
  }
  return events.slice(-limit);
}



/**
 * Calls back with each event appended from now on.
 *
 * Purpose: Stream new hook events to browsers live.
 *
 * @param onEvent Callback receiving one event.
 * @returns Function that stops watching.
 */
export function watchEvents(onEvent) {
  // Remember the read offset and poll for growth.
  fs.mkdirSync(STATE_DIR, { recursive: true });
  let offset = fs.existsSync(EVENTS_FILE) ? fs.statSync(EVENTS_FILE).size : 0;
  const timer = setInterval(() => {
    // Read only the bytes appended since the last poll.
    if (!fs.existsSync(EVENTS_FILE)) return;
    const size = fs.statSync(EVENTS_FILE).size;
    if (size < offset) offset = 0;
    if (size === offset) return;
    const handle = fs.openSync(EVENTS_FILE, "r");
    const chunk = Buffer.alloc(size - offset);
    fs.readSync(handle, chunk, 0, chunk.length, offset);
    fs.closeSync(handle);
    offset = size;
    for (const event of parseLines(chunk.toString("utf8"))) onEvent(event);
  }, 500);
  return () => clearInterval(timer);
}



/**
 * Reads a JSON file written by the status line.
 *
 * Purpose: Share safe reads between usage and stats.
 *
 * @param file Absolute file path.
 * @returns Parsed JSON, or null when missing.
 */
function readJson(file) {
  // Missing or half-written files mean no data yet.
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}



/**
 * Reads plan usage and each session's latest stats.
 *
 * Purpose: Show 5-hour and weekly limits plus session cost.
 *
 * @param sessionIds Session ids to look up.
 * @returns Usage windows and stats keyed by session id.
 */
export function readUsage(sessionIds = []) {
  // The status line writes both kinds of file.
  const stats = Object.fromEntries(sessionIds.map((id) => [id, readJson(path.join(STATE_DIR, "sessions", `${id}.json`))]));
  return { plan: readJson(path.join(STATE_DIR, "usage.json")), sessions: stats };
}
