#!/usr/bin/env node
// Lets the master, workers, and the owner control command-center sessions.
// Talks to the local server started by npm run command-center.

import fs from "node:fs";
import { loadConfig } from "../config/load.mjs";
import { runCheck } from "./project/check.mjs";
import { runKitCommand } from "./project/kit.mjs";
import { createLabels } from "./project/labels.mjs";
import { QUEUE_COMMANDS, describeState } from "./queue.mjs";
import { verifyPullRequest } from "./verify/verify-pr.mjs";
import { VERSION_USAGE, runVersion } from "./version/commands.mjs";

/** Base URL of the local command-center API. */
const API = `http://127.0.0.1:${process.env.COMMAND_CENTER_PORT ?? loadConfig().port}/api`;

/** Usage text for unknown commands. */
const USAGE = `Usage: npm run cc -- <command>
  sessions                                   list sessions and their state
  spawn <issue> <slug> --brief-file <path> [--model sonnet|opus] [--base <ref>]
  send <name> <message...> [--now]           queue a message; it arrives after the turn, never into a draft
  queue [cancel <id>]                        list waiting messages, or cancel one
  interrupt <name>                           press Escape in a session (assistant only)
  screen <name> [--lines 60]                 read a session's recent output
  stop <name> [--forget]                     stop a session (and drop its log)
  check [--since <ref>] [--list]             run the gate: project checks, then enforcement
  verify <pr>                                verify a PR merged with its base, locally
  labels                                     create or update the kit's GitHub labels
  setup done                                 end first-run setup; start the master
  render                                     re-render kit files after settings change
  update [--from <path|git-url>] [--ref <r>] update the kit, keeping project files
${VERSION_USAGE}`;



/**
 * Calls the command-center API.
 *
 * Purpose: Share request and error handling across commands.
 *
 * @param route Path after /api.
 * @param body Optional JSON body; sends a POST when present.
 * @returns Parsed JSON response.
 */
async function call(route, body) {
  // A refused connection means the server is not running.
  let response;
  try {
    // Sessions name themselves; the server checks this on stop.
    const from = process.env.COMMAND_CENTER_SESSION ? { "x-cc-from": process.env.COMMAND_CENTER_SESSION } : {};
    const options = body ? { method: "POST", headers: { "content-type": "application/json", ...from }, body: JSON.stringify(body) } : { headers: from };
    response = await fetch(`${API}${route}`, options);
  } catch {
    throw new Error("The command center is not running. Start it with: npm run command-center");
  }
  const value = await response.json();
  if (!response.ok) throw new Error(value.error ?? `HTTP ${response.status}`);
  return value;
}



/**
 * Reads a --flag value from the arguments.
 *
 * Purpose: Keep argument parsing dependency-free.
 *
 * @param args Command arguments.
 * @param name Flag name without dashes.
 * @returns Flag value, or undefined.
 */
function flag(args, name) {
  // The value follows the flag.
  const index = args.indexOf(`--${name}`);
  return index === -1 ? undefined : args[index + 1];
}



/**
 * Runs one CLI command.
 *
 * Purpose: Map commands onto API calls and print results.
 *
 * The verify and version commands run locally; no server needed.
 *
 * Inputs: None.
 *
 * @returns Promise resolving when output is printed.
 */
async function main() {
  // Dispatch on the first argument.
  const [command, ...args] = process.argv.slice(2);
  if (command === "verify") {
    process.exitCode = verifyPullRequest(args[0]);
  } else if (command === "check") {
    process.exitCode = runCheck(args);
  } else if (command === "labels") {
    process.exitCode = createLabels();
  } else if (["setup", "render", "update"].includes(command)) {
    process.exitCode = await runKitCommand(command, args, call);
  } else if (command === "version") {
    process.exitCode = await runVersion(args);
  } else if (command === "sessions") {
    for (const item of await call("/sessions")) {
      const state = item.alive ? describeState(item.turn) : `exited ${item.exitCode}`;
      console.log(`${item.name.padEnd(42)} ${item.kind.padEnd(9)} ${(item.meta.model ?? "").padEnd(7)} ${state}`);
    }
  } else if (command === "spawn") {
    const [issue, slug] = args;
    const briefFile = flag(args, "brief-file");
    const brief = briefFile ? fs.readFileSync(briefFile, "utf8") : flag(args, "brief");
    const created = await call("/sessions", { issue, slug, model: flag(args, "model") ?? "sonnet", brief, base: flag(args, "base") });
    console.log(`Started ${created.name} (${created.meta.model}) in ${created.cwd}`);
  } else if (QUEUE_COMMANDS[command]) {
    await QUEUE_COMMANDS[command](call, args);
  } else if (command === "screen") {
    console.log((await call(`/screen/${encodeURIComponent(args[0])}?lines=${flag(args, "lines") ?? 60}`)).text);
  } else if (command === "stop") {
    await call(`/stop/${encodeURIComponent(args[0])}${args.includes("--forget") ? "?forget" : ""}`, {});
    console.log(`Stopped ${args[0]}.`);
  } else {
    console.log(USAGE);
    process.exitCode = 1;
  }
}



// Print errors plainly for agents and people.
main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
