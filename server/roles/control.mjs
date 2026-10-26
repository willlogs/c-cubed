// Starts the control sessions: the owner's assistant and the master.
// On a first run, the assistant is the setup interviewer.

import { randomUUID } from "node:crypto";
import { startSession } from "../sessions/terminals.mjs";
import { insideContext, masterRole } from "./prompts.mjs";



/**
 * Starts one Opus control session in the main checkout.
 *
 * Purpose: Share flags between the assistant and the master.
 *
 * @param repoRoot Main checkout path.
 * @param name Session name, also its role.
 * @param args Role-specific Claude arguments.
 * @returns The session record.
 */
function startControl(repoRoot, name, args) {
  // Auto mode lets sessions act without waiting on the owner.
  const sessionId = randomUUID();
  const base = ["--model", "opus", "--name", name, "--session-id", sessionId, "--permission-mode", "auto"];
  return startSession({ name, kind: name, cwd: repoRoot, command: "claude", args: [...base, ...args], meta: { model: "opus", sessionId } });
}



/**
 * Starts the assistant, the session the owner talks to.
 *
 * Purpose: Answer the owner without interrupting the master.
 *
 * @param repoRoot Main checkout path.
 * @returns The assistant session record.
 */
export function startAssistant(repoRoot) {
  // Its role lives in .claude/agents/assistant.md.
  return startControl(repoRoot, "assistant", ["--agent", "assistant", "--append-system-prompt", insideContext("assistant")]);
}



/**
 * Starts the setup interviewer in the assistant's place.
 *
 * Purpose: Set rules and decisions up before any work.
 *
 * @param repoRoot Main checkout path.
 * @returns The setup session record, named assistant.
 */
export function startSetup(repoRoot) {
  // The owner talks to it like the assistant.
  return startControl(repoRoot, "assistant", ["--agent", "setup", "--append-system-prompt", insideContext("assistant")]);
}



/**
 * Starts the master, the session workers talk to.
 *
 * Purpose: Keep one session directing all workers.
 *
 * @param repoRoot Main checkout path.
 * @returns The master session record.
 */
export function startMaster(repoRoot) {
  // Starts idle; queued messages give it work.
  return startControl(repoRoot, "master", ["--append-system-prompt", `${masterRole()} ${insideContext("master")}`]);
}
