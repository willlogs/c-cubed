#!/usr/bin/env node
// Blocks commands that would stop the hosting command center,
// and enforces merge and branch rules in every session.

import fs from "node:fs";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../config/load.mjs";
import { mainCheckout } from "../config/paths.mjs";
import { policyReason } from "./policy.mjs";

/** How to test command-center changes safely instead. */
const SAFE_COPY = "To test command-center changes, run a copy on a free port from 8096 to 8099: "
  + "COMMAND_CENTER_PORT=8096 node tools/command-center/server/main.mjs --no-master --no-open, and stop only that copy by its own pid.";



/**
 * Tells whether a command starts a command center unsafely.
 *
 * Purpose: Allow private test copies, never a second live one.
 *
 * @param command Shell command text.
 * @param port Port of the live command center.
 * @returns True for control sessions or the live port.
 */
function startsServer(command, port) {
  // The npm scripts always start the assistant and master.
  if (/npm run command-center|npm --prefix tools\/command-center start/.test(command)) return true;
  if (!/\bnode\s+(\S*\/)?server\/main\.mjs\b/.test(command)) return false;
  const chosen = /COMMAND_CENTER_PORT=(\d+)/.exec(command)?.[1];
  return !chosen || chosen === port || !/--no-master\b/.test(command);
}



/**
 * Explains why a command must not run, if so.
 *
 * Purpose: Keep the guard's rules pure and testable.
 *
 * @param command Shell command text.
 * @param env Session variables: name, role, port, and server pid.
 * @returns Reason text, or null when the command may run.
 */
export function blockReason(command, env) {
  // Outside the command center nothing is blocked.
  if (!env.COMMAND_CENTER_SESSION) return null;
  const port = env.COMMAND_CENTER_PORT ?? "8095";
  const pid = env.COMMAND_CENTER_PID;
  const mentionsPort = new RegExp(`(^|[^0-9])${port}([^0-9]|$)`).test(command);

  // Killing broadly, by the server's pid, or by its port.
  if (/\b(pkill|killall)\b/.test(command) && /\b(node|claude|npm|main\.mjs|command-center)\b/.test(command)) {
    return "pkill or killall on node, npm, or claude would also stop the command center and every session in it.";
  }
  if (/\bkill\b/.test(command) && ((pid && new RegExp(`\\b${pid}\\b`).test(command)) || /COMMAND_CENTER_PID/.test(command))) {
    return `pid ${pid} is the command center itself.`;
  }
  if (mentionsPort && /\b(kill|fuser|pkill)\b/.test(command)) return `port ${port} is the live command center.`;

  // Starting servers and stopping or interrupting control sessions.
  if (startsServer(command, port)) return `that would start a second command center on port ${port} or new control sessions.`;
  if (/\bcc\b[^|;&]*\bstop\s+(master|assistant)\b|\/api\/stop\/(master|assistant)\b/.test(command)) {
    return "only the owner stops the master or the assistant, from the page.";
  }
  if (env.COMMAND_CENTER_ROLE !== "assistant" && /\bcc\b[^|;&]*\binterrupt\b|\/api\/interrupt\//.test(command)) {
    return "only the assistant interrupts sessions, and only when the owner asks.";
  }
  return null;
}



/**
 * Reads the hook payload and blocks unsafe commands.
 *
 * Purpose: Run as a PreToolUse hook for Bash.
 *
 * Inputs: None.
 *
 * @returns No value.
 *
 * Side effects: Exits with code 2 when blocking.
 */
function main() {
  // Unreadable payloads never block a session.
  let hook = {};
  try {
    hook = JSON.parse(fs.readFileSync(0, "utf8"));
  } catch {
    return;
  }
  const command = hook.tool_input?.command ?? "";

  // Session safety first: it applies inside the command center.
  const reason = blockReason(command, process.env);
  if (reason) {
    process.stderr.write(`Blocked by the command-center guard: ${reason} `
      + `You are "${process.env.COMMAND_CENTER_SESSION}" inside the command center on port ${process.env.COMMAND_CENTER_PORT}. ${SAFE_COPY}\n`);
    process.exit(2);
  }

  // Merge and branch rules apply to every session.
  const rule = enforcedRule(command, hook.cwd ?? process.cwd());
  if (!rule) return;
  process.stderr.write(`Blocked by the command-center guard: ${rule} If the owner wants it anyway, they run it themselves with ! <command>.\n`);
  process.exit(2);
}



/**
 * Checks merge and branch rules when the command needs it.
 *
 * Purpose: Skip git and config reads for ordinary commands.
 *
 * @param command Bash command text.
 * @param cwd Folder the command runs in.
 * @returns Reason to block, or null.
 */
function enforcedRule(command, cwd) {
  // Only pushes and merges can break these rules.
  if (!/\bgit\b[^;&|]*\bpush\b|\bgh\s+pr\s+merge\b/.test(command)) return null;
  try {
    return policyReason(command, loadConfig(mainCheckout(cwd)).branches, cwd);
  } catch {
    // Outside a git checkout there is nothing to protect.
    return null;
  }
}



// Run only as a script, so tests import the rules.
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
