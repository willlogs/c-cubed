#!/usr/bin/env node
// Appends one compact activity event per Claude hook call.
// Feeds the command center without slowing or blocking sessions.

import fs from "node:fs";
import path from "node:path";
import { stateDir } from "../config/paths.mjs";



/**
 * Picks the most telling part of a hook payload.
 *
 * Purpose: Show what a session does in one line.
 *
 * @param hook Parsed hook input.
 * @returns Short description, at most 200 characters.
 */
function detail(hook) {
  // Prefer commands, files, and messages over raw input.
  const input = hook.tool_input ?? {};
  const text = input.command ?? input.file_path ?? input.description ?? input.url ?? input.pattern
    ?? hook.message ?? hook.last_assistant_message ?? hook.prompt ?? "";
  return String(text).replace(/\s+/g, " ").slice(0, 200);
}



/**
 * Records the hook event from stdin.
 *
 * Purpose: Give the activity feed every tool call and stop.
 *
 * Inputs: None.
 *
 * @returns No value.
 *
 * Side effects: Appends one line to the event log.
 */
function main() {
  // Never fail the session: any error just skips the event.
  try {
    const hook = JSON.parse(fs.readFileSync(0, "utf8"));
    const event = {
      at: new Date().toISOString(),
      session: hook.session_id,
      cwd: hook.cwd,
      event: hook.hook_event_name,
      tool: hook.tool_name ?? hook.agent_type ?? hook.notification_type,
      detail: detail(hook),
      // Command-center sessions name themselves and their server.
      name: process.env.COMMAND_CENTER_SESSION,
      port: process.env.COMMAND_CENTER_SESSION ? process.env.COMMAND_CENTER_PORT : undefined,
      notification: hook.notification_type,
    };
    // Each project keeps its own feed beside its git folder.
    const folder = stateDir(hook.cwd ?? process.cwd());
    fs.mkdirSync(folder, { recursive: true });
    fs.appendFileSync(path.join(folder, "events.jsonl"), `${JSON.stringify(event)}\n`);
  } catch {
    // Recording is best effort.
  }
}



// Exit quietly so the hook never changes behavior.
main();
