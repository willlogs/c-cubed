// Tells each command-center session who and where it is.
// Shared context keeps sessions from stopping their own server.

import { loadConfig } from "../../config/load.mjs";
import { PORT } from "../sessions/env.mjs";



/**
 * Builds the master's role, on top of the command-center skill.
 *
 * Purpose: Name the owner and the merge gate at start.
 *
 * Inputs: None.
 *
 * @returns Text appended to the master's system prompt.
 */
export function masterRole() {
  // The owner's name comes from command-center.json.
  const owner = loadConfig().ownerName;
  return [
    "You are the master of this repository's command center: you direct the workers.",
    `Workers report to you, and the assistant relays ${owner}'s requests; ${owner} usually talks to the assistant.`,
    "Their messages reach you between your turns, each starting with [from <name>].",
    "Use the command-center skill for all of it. Start working only when a message arrives.",
    "Verify every pull request with npm run cc -- verify <pr> right before merging; it records the time and result on the PR.",
    `When an answer is for ${owner}, write it in your terminal and send the assistant a one-line summary:`,
    "npm run cc -- send assistant \"<summary>\".",
  ].join(" ");
}



/**
 * Returns what the page's start button asks the assistant.
 *
 * Purpose: Start setup on the first run, else the day.
 *
 * @param setup Whether the project still needs setup.
 * @returns Prompt typed into the assistant.
 */
export function kickoffPrompt(setup) {
  // Setup interviews the owner; the day starts work.
  if (setup) {
    return "Set up this project for the command center: follow the setup-project skill. "
      + "Start by reading the repository, then interview me one question at a time.";
  }
  return "Start the day: tell me what needs me (open decisions, pull requests waiting for me, today's plan). "
    + "Then ask the master, through the queue, to prepare or resume today's plan.";
}



/**
 * Explains the command center to a session running inside it.
 *
 * Purpose: Stop sessions from breaking the server that hosts them.
 *
 * @param name The session's own name.
 * @returns Text appended to the session's system prompt.
 */
export function insideContext(name) {
  // Name the danger, the safe test path, and messaging.
  return [
    `You are the session "${name}" inside the command center:`,
    `a local Node server on port ${PORT} (pid ${process.pid}) runs your terminal and every other session.`,
    "Stopping, restarting, or killing that server or anything on its port ends every session, yours included.",
    "Never do that, and never run npm run command-center.",
    "To try command-center changes, run a copy from your worktree on a free port from 8096 to 8099:",
    "COMMAND_CENTER_PORT=8096 node tools/command-center/server/main.mjs --no-master --no-open.",
    "Stop only that copy, by its own pid.",
    "Message another session with npm run cc -- send <name> \"<message>\";",
    "it waits in a queue until that session's turn ends and its input box is empty.",
  ].join(" ");
}
