#!/usr/bin/env node
// Prints plan usage and saves it for the command center.
// Claude Code calls this with session JSON on stdin.

import fs from "node:fs";
import path from "node:path";
import { stateDir } from "../config/paths.mjs";



/**
 * Reads the session JSON Claude Code sends on stdin.
 *
 * Purpose: Tolerate missing or partial status payloads.
 *
 * Inputs: None.
 *
 * @returns Parsed payload, or an empty object.
 */
function readSession() {
  // A broken payload must never break the status line.
  try {
    return JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return {};
  }
}



/**
 * Finds the project's state folder for this session.
 *
 * Purpose: Keep usage per project; never break the line.
 *
 * @param session Session JSON from Claude Code.
 * @returns Folder path, or null outside a git checkout.
 */
function usageFolder(session) {
  // Sessions started by the command center carry it.
  try {
    return stateDir(session.workspace?.current_dir ?? session.cwd ?? process.cwd());
  } catch {
    return null;
  }
}



/**
 * Formats one usage window as a short label.
 *
 * Purpose: Keep the status line readable at a glance.
 *
 * @param label Window name such as 5h.
 * @param window Rate-limit window from the payload.
 * @returns Label like "5h 34%", or an empty string.
 */
function windowLabel(label, window) {
  // Plans without rate-limit data simply omit the label.
  const used = window?.used_percentage;
  return typeof used === "number" ? `${label} ${Math.round(used)}%` : "";
}



/**
 * Prints the status line and records usage.
 *
 * Purpose: Show plan usage to the owner and the master.
 *
 * Inputs: None.
 *
 * @returns No value.
 *
 * Side effects: Writes the usage snapshot file.
 */
function main() {
  // Save plan windows and this session's stats when reported.
  const session = readSession();
  const limits = session.rate_limits;
  const folder = usageFolder(session);
  if (folder) fs.mkdirSync(path.join(folder, "sessions"), { recursive: true });
  if (folder && limits) fs.writeFileSync(path.join(folder, "usage.json"), JSON.stringify({ at: new Date().toISOString(), ...limits }, null, 2));
  if (folder && session.session_id) {
    const stats = { at: new Date().toISOString(), model: session.model?.display_name, cost: session.cost, context: session.context_window };
    fs.writeFileSync(path.join(folder, "sessions", `${session.session_id}.json`), JSON.stringify(stats));
  }

  // Show model, both usage windows, and the folder name.
  const parts = [
    session.model?.display_name ?? "Claude",
    windowLabel("5h", limits?.five_hour),
    windowLabel("7d", limits?.seven_day),
    path.basename(session.workspace?.current_dir ?? process.cwd()),
  ];
  process.stdout.write(parts.filter(Boolean).join(" · "));
}



// Claude Code reads the single printed line.
main();
