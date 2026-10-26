// Runs a second command center from a PR's merged tree.
// Lets the owner try command-center changes before they merge.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { KIT_FOLDER } from "../../../config/defaults.mjs";
import { portFree, waitForPort } from "../../../instances/stacks/ports.mjs";

/** Ports tried for previews; 8095 is the real command center. */
const PORTS = { first: 8096, last: 8199 };

/** How long a preview may take to start listening. */
const START_MS = 20_000;

/** How long a stopping preview may take before SIGKILL. */
const STOP_MS = 5_000;

/** Running previews by row id. */
const previews = new Map();

// Previews never outlive the command center that started them.
process.once("exit", () => {
  for (const preview of previews.values()) preview.child.kill();
});



/**
 * Lists running previews by row id.
 *
 * Purpose: Show Open and Stop on the right rows.
 *
 * Inputs: None.
 *
 * @returns Port, URL, and start time per row id.
 */
export function listPreviews() {
  // Child handles stay on the server.
  return Object.fromEntries([...previews].map(([id, { port, url, startedAt }]) => [id, { port, url, startedAt }]));
}



/**
 * Starts, or restarts, the command center from a worktree.
 *
 * Purpose: Serve a PR's command center beside the real one.
 *
 * Side effects: May install packages; spawns a server process.
 *
 * @param id Row id the preview belongs to.
 * @param worktree Worktree holding the PR's merge result.
 * @param log Job callback receiving progress text.
 * @returns Promise resolving once the preview listens.
 */
export async function startPreview(id, worktree, log) {
  // Restart on the current tree, keeping the port if free.
  await stopPreview(id);
  const folder = path.join(worktree, KIT_FOLDER);
  await installPackages(folder, log);
  const port = await freePort();

  // No control sessions or browser tab: the owner opens it.
  log(`Starting the preview on port ${port}…`);
  const env = { ...process.env, COMMAND_CENTER_PORT: String(port) };
  const child = spawn(process.execPath, ["server/main.mjs", "--no-master", "--no-open"], { cwd: folder, env });
  const preview = { child, port, url: `http://127.0.0.1:${port}`, startedAt: Date.now(), output: "" };
  child.stdout.on("data", (chunk) => { preview.output = (preview.output + chunk).slice(-2000); });
  child.stderr.on("data", (chunk) => { preview.output = (preview.output + chunk).slice(-2000); });
  child.once("exit", () => { if (previews.get(id) === preview) previews.delete(id); });
  previews.set(id, preview);

  // Fail with the preview's own output if it dies first.
  const died = new Promise((_, reject) => child.once("exit", (code) => reject(new Error(`Preview exited ${code}: ${lastLine(preview.output)}`))));
  died.catch(() => {});
  try {
    await Promise.race([waitForPort(port, START_MS), died]);
  } catch (error) {
    // A preview that never listened must not linger.
    await stopPreview(id);
    throw error;
  }
}



/**
 * Returns the last non-empty line of some output.
 *
 * Purpose: Explain a failed preview in one line.
 *
 * @param output Recent output text.
 * @returns Last line, or an empty string.
 */
function lastLine(output) {
  // Trailing newlines would leave an empty last line.
  return output.trim().split("\n").at(-1) ?? "";
}



/**
 * Stops one row's preview and waits for it to exit.
 *
 * Purpose: Free the port before anything reuses it.
 *
 * Side effects: Sends SIGTERM, then SIGKILL after a wait.
 *
 * @param id Row id.
 * @returns Promise resolving with whether a preview ran.
 */
export async function stopPreview(id) {
  // The preview's own shutdown handler exits cleanly.
  const preview = previews.get(id);
  if (!preview) return false;
  previews.delete(id);
  if (preview.child.exitCode !== null || preview.child.signalCode !== null) return true;
  const exited = new Promise((resolve) => preview.child.once("exit", resolve));
  preview.child.kill("SIGTERM");

  // Its shutdown waits 1.5s; force it after five.
  const timer = setTimeout(() => preview.child.kill("SIGKILL"), STOP_MS);
  await exited;
  clearTimeout(timer);
  return true;
}



/**
 * Installs the command center's own packages once.
 *
 * Purpose: Not a workspace, so root npm ci skips it.
 *
 * Side effects: Runs npm ci in the preview's folder.
 *
 * @param folder The worktree's tools/command-center folder.
 * @param log Job callback receiving progress text.
 * @returns Promise resolving when packages exist.
 */
function installPackages(folder, log) {
  // Same check as the package's prestart script.
  if (fs.existsSync(path.join(folder, "node_modules", "node-pty"))) return Promise.resolve();
  log("Installing the command center's packages…");
  return new Promise((resolve, reject) => {
    // Keep stderr so a failed native build explains itself.
    let errors = "";
    const child = spawn("npm", ["ci", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: folder, stdio: ["ignore", "ignore", "pipe"] });
    child.stderr.on("data", (chunk) => { errors += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`npm ci failed: ${errors.trim().slice(-300)}`))));
  });
}



/**
 * Finds a free port for a new preview.
 *
 * Purpose: Avoid the real command center and other previews.
 *
 * Inputs: None.
 *
 * @returns Free loopback port.
 */
async function freePort() {
  // Skip ports other previews hold, then probe the rest.
  const held = new Set([...previews.values()].map((item) => item.port));
  for (let port = PORTS.first; port <= PORTS.last; port += 1) {
    if (!held.has(port) && await portFree(port)) return port;
  }
  throw new Error(`No free port between ${PORTS.first} and ${PORTS.last}.`);
}
