// Ends setup from the page or CLI; starts normal sessions.
// The checks themselves live in config/setup.mjs.

import { assertSetupComplete } from "../../config/setup.mjs";
import { listSessions, stopSession } from "../sessions/terminals.mjs";
import { startAssistant, startMaster } from "./control.mjs";



/**
 * Records the end of setup and starts the normal sessions.
 *
 * Purpose: Switch from interview to work without a restart.
 *
 * @param repoRoot Main checkout path.
 * @returns Confirmation once recorded.
 *
 * Side effects: Replaces the assistant; starts the master.
 */
export function finishSetup(repoRoot) {
  // Refuse while anything is missing.
  assertSetupComplete(repoRoot);

  // Answer first; the caller is the session being replaced.
  setTimeout(() => {
    // Swap the interviewer for the assistant; add the master.
    const running = listSessions().filter((item) => item.alive).map((item) => item.name);
    if (running.includes("assistant")) stopSession("assistant", true);
    if (!running.includes("master")) startMaster(repoRoot);
    startAssistant(repoRoot);
  }, 1500);
  return { ok: true, message: "Setup is done. The assistant restarts as the owner's assistant, and the master starts." };
}



// The server asks the same question at start.
export { needsSetup } from "../../config/setup.mjs";
