// Builds each session's environment, including who and where it is.
// Sessions read it to know which command center hosts them.

import { loadConfig } from "../../config/load.mjs";
import { stateDir } from "../../config/paths.mjs";

/** Local port for the UI and API; loopback only. */
export const PORT = Number(process.env.COMMAND_CENTER_PORT ?? loadConfig().port);

/** State folder every session's hooks write to. */
export const STATE_DIR = stateDir();

/** Session markers a child must not inherit from Claude. */
const STRIPPED_ENV = [
  "CLAUDECODE", "CLAUDE_PID", "CLAUDE_EFFORT", "CLAUDE_CODE_CHILD_SESSION", "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_SESSION_ATTENDED", "CLAUDE_CODE_ENTRYPOINT", "CLAUDE_CODE_EXECPATH", "CLAUDE_CODE_SSE_PORT",
  "CLAUDE_CODE_MESSAGING_SOCKET", "CLAUDE_CODE_MESSAGING_TOKEN",
];



/**
 * Names a session and its command center in variables.
 *
 * Purpose: Let hooks, the CLI, and prompts identify the session.
 *
 * @param name Session name, such as master.
 * @param kind Role: assistant, setup, master, or worker.
 * @returns Variables every child of this session inherits.
 */
export function identityEnv(name, kind) {
  // The guard hook and cc CLI read these.
  return {
    COMMAND_CENTER_SESSION: name,
    COMMAND_CENTER_ROLE: kind,
    COMMAND_CENTER_PORT: String(PORT),
    COMMAND_CENTER_PID: String(process.pid),
    COMMAND_CENTER_STATE: STATE_DIR,
  };
}



/**
 * Copies the environment without nested-session markers.
 *
 * Purpose: Start child Claude sessions as top-level sessions.
 *
 * @param extra Variables to add for this session.
 * @returns Environment for the child terminal.
 */
export function childEnv(extra = {}) {
  // Drop markers inherited from a parent Claude session.
  const env = { ...process.env, TERM: "xterm-256color", ...extra };
  for (const key of STRIPPED_ENV) delete env[key];
  return env;
}
