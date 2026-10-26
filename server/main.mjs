#!/usr/bin/env node
// Starts the command center: UI server, control sessions, and shutdown.
// Runs in the foreground; Ctrl-C stops every session it started.

import { spawn } from "node:child_process";
import http from "node:http";
import { mainCheckout } from "../config/paths.mjs";
import { attachHub } from "./hub.mjs";
import { startDelivery } from "./queue/store.mjs";
import { startAssistant, startMaster, startSetup } from "./roles/control.mjs";
import { needsSetup } from "./roles/setup.mjs";
import { handleHttp } from "./routes.mjs";
import { PORT } from "./sessions/env.mjs";
import { stopAll } from "./sessions/terminals.mjs";



/**
 * Opens the UI in the default browser, when one exists.
 *
 * Purpose: Save the owner a step on every start.
 *
 * @param url Address to open.
 * @returns No value.
 */
function openBrowser(url) {
  // A missing opener is fine; the URL is printed anyway.
  const child = spawn("xdg-open", [url], { stdio: "ignore", detached: true });
  child.on("error", () => {});
  child.unref();
}



/**
 * Stops every session, then exits.
 *
 * Purpose: Make Ctrl-C end all command-center work.
 *
 * Inputs: None.
 *
 * @returns No value.
 *
 * Side effects: Kills child sessions and exits the process.
 */
function shutdown() {
  // Give sessions a moment to exit cleanly.
  console.log("\nStopping the assistant, the master, and every worker...");
  stopAll();
  setTimeout(() => process.exit(0), 1500);
}



/**
 * Starts setup on a first run, else assistant and master.
 *
 * Purpose: Rules and decisions come before any work.
 *
 * @param repoRoot Main checkout path.
 * @returns No value.
 */
function startControlSessions(repoRoot) {
  // Previews run without control sessions.
  if (process.argv.includes("--no-master")) return;
  if (needsSetup(repoRoot)) {
    console.log("First run: press Start setup; the assistant interviews you and sets up rules and decisions.");
    startSetup(repoRoot);
    return;
  }
  startAssistant(repoRoot);
  startMaster(repoRoot);
}



/**
 * Starts the server, the queue, and the control sessions.
 *
 * Purpose: Bring the command center up in one command.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
function main() {
  // Serve HTTP and the WebSocket hub on loopback.
  const repoRoot = mainCheckout();
  const server = http.createServer((request, response) => handleHttp(repoRoot, request, response));
  attachHub(server);
  server.on("error", (error) => {
    console.error(`Cannot listen on ${PORT}: ${error.message}. Is the command center already running?`);
    process.exit(1);
  });

  // Start the control sessions once the UI can show them.
  server.listen(PORT, "127.0.0.1", () => {
    // Print the address, then start sessions, delivery, and browser.
    const url = `http://127.0.0.1:${PORT}`;
    console.log(`Command center: ${url}`);
    console.log("Ctrl-C here stops the assistant, the master, every worker, and this server.");
    startControlSessions(repoRoot);
    startDelivery();
    if (!process.argv.includes("--no-open")) openBrowser(url);
  });
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}



// Run in the foreground until Ctrl-C.
main();
