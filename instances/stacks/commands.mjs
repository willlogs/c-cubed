// Runs the project's stack commands with the stack's ports.
// Commands are shell strings from command-center.json.

import { spawn } from "node:child_process";
import fs from "node:fs";



/**
 * Fills a command's placeholders from a stack record.
 *
 * Purpose: Let one template serve every stack.
 *
 * @param template Text with {name}, {worktree}, or {port.<key>}.
 * @param record Stack record with name, worktree, and ports.
 * @returns Expanded text; unknown placeholders stay.
 */
export function expandCommand(template, record) {
  // Ports are read by their configured names.
  return String(template).replace(/\{(name|worktree|port\.([a-z0-9_-]+))\}/gi, (whole, key, port) => {
    if (port) return String(record.ports?.[port] ?? whole);
    return String(record[key] ?? whole);
  });
}



/**
 * Builds the environment a stack command runs with.
 *
 * Purpose: Give scripts the same facts as placeholders.
 *
 * @param record Stack record.
 * @returns Variables added to the parent environment.
 */
export function stackEnv(record) {
  // PORT is the first named port, for simple apps.
  const ports = Object.entries(record.ports ?? {});
  const named = Object.fromEntries(ports.map(([key, port]) => [`CC_PORT_${key.toUpperCase().replace(/-/g, "_")}`, String(port)]));
  const first = ports[0] ? { PORT: String(ports[0][1]) } : {};
  return { ...process.env, CC_INSTANCE: record.name, CC_WORKTREE: record.worktree, ...first, ...named };
}



/**
 * Runs a stack command to completion.
 *
 * Purpose: Start or stop stacks that manage themselves.
 *
 * @param template Command template from the settings.
 * @param record Stack record.
 * @param options timeoutMs, and quiet to hide output.
 * @returns Promise resolving on exit 0, else rejecting.
 */
export function runShell(template, record, { timeoutMs = 0, quiet = false } = {}) {
  // Run in the stack's worktree with its variables.
  return new Promise((resolve, reject) => {
    // A timeout kills commands that hang, such as health checks.
    const command = expandCommand(template, record);
    const child = spawn("sh", ["-c", command], { cwd: record.worktree, env: stackEnv(record), stdio: quiet ? "ignore" : "inherit" });
    const timer = timeoutMs ? setTimeout(() => child.kill("SIGKILL"), timeoutMs) : null;
    child.once("error", reject);
    child.once("exit", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`Stack command failed (${code ?? "killed"}): ${command}`));
    });
  });
}



/**
 * Starts a long-running stack command in the background.
 *
 * Purpose: Run dev servers that never exit by themselves.
 *
 * @param template Command template from the settings.
 * @param record Stack record.
 * @param logFile File that receives its output.
 * @returns Process id, also its process group id.
 *
 * Side effects: Spawns a detached process group.
 */
export function spawnDetached(template, record, logFile) {
  // Its own group lets stop end every child too.
  const log = fs.openSync(logFile, "a");
  const child = spawn("sh", ["-c", expandCommand(template, record)], { cwd: record.worktree, env: stackEnv(record), detached: true, stdio: ["ignore", log, log] });
  fs.closeSync(log);
  child.unref();
  return child.pid;
}



/**
 * Tells whether a process still runs.
 *
 * Purpose: Spot background stacks that died.
 *
 * @param pid Process id, or nothing.
 * @returns True when the process exists.
 */
export function processAlive(pid) {
  // Signal 0 checks existence without touching it.
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}



/**
 * Stops a background stack's whole process group.
 *
 * Purpose: End the server and every child it started.
 *
 * @param pid Process group id.
 * @returns Promise resolving once it is gone.
 *
 * Side effects: Sends SIGTERM, then SIGKILL after five seconds.
 */
export async function killGroup(pid) {
  // A negative pid signals the whole group.
  if (!processAlive(pid)) return;
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    return;
  }
  for (let waited = 0; waited < 5000 && processAlive(pid); waited += 100) await new Promise((resolve) => setTimeout(resolve, 100));
  if (processAlive(pid)) process.kill(-pid, "SIGKILL");
}
