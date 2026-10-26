// Starts worker sessions, each in its own issue worktree.
// Keeps worker models, limits, and worktree setup in one place.

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import { loadConfig } from "../../config/load.mjs";
import { worktreePath } from "../../config/paths.mjs";
import { listSessions, startSession } from "../sessions/terminals.mjs";
import { existingIssueWorktree, workerName } from "./names.mjs";
import { insideContext } from "./prompts.mjs";

/** Models a worker may run. */
const MODELS = ["sonnet", "opus", "haiku"];



/**
 * Returns how many workers may run at once.
 *
 * Purpose: Settings decide; the environment may override.
 *
 * Inputs: None.
 *
 * @returns Positive worker limit.
 */
export function maxWorkers() {
  // Stacks are capped separately, in their own settings.
  return Number(process.env.COMMAND_CENTER_MAX_WORKERS ?? loadConfig().workers.max);
}



/**
 * Runs a command and resolves when it succeeds.
 *
 * Purpose: Create worktrees without freezing the server.
 *
 * @param command Executable to run.
 * @param args Command arguments.
 * @param cwd Folder where it runs.
 * @returns Promise resolving with no value.
 */
function runAsync(command, args, cwd) {
  // Collect stderr so failures explain themselves.
  return new Promise((resolve, reject) => {
    // Keep stderr for the error message.
    let errors = "";
    const child = spawn(command, args, { cwd, stdio: ["ignore", "ignore", "pipe"] });
    child.stderr.on("data", (chunk) => { errors += chunk; });
    child.once("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} failed: ${errors.slice(-400)}`))));
  });
}



/**
 * Creates a worktree and starts a worker session in it.
 *
 * Purpose: Turn the master's briefing into a running worker.
 *
 * @param repoRoot Main checkout path.
 * @param request Issue, slug, model, briefing, and optional base ref.
 * @returns Promise resolving with the worker session record.
 *
 * Side effects: May create a worktree and branch.
 */
export async function spawnWorker(repoRoot, { issue, slug, model, brief, base }) {
  // Validate the request and the running-worker limit.
  const config = loadConfig(repoRoot);
  const chosen = model ?? config.workers.model;
  if (!/^\d+$/.test(String(issue))) throw new Error("issue must be a number");
  if (!MODELS.includes(chosen)) throw new Error("model must be sonnet, opus, or haiku");
  if (!brief?.trim()) throw new Error("a briefing is required");
  const running = listSessions().filter((item) => item.kind === "worker" && item.alive);
  if (running.length >= maxWorkers()) throw new Error(`${running.length} workers already run; the limit is ${maxWorkers()}.`);

  // Reuse the issue's worktree, or prepare one from the trunk.
  const name = existingIssueWorktree(issue) ?? workerName(issue, slug);
  const worktree = worktreePath(name);
  const baseArgs = base ? ["--base", base] : [];
  if (!fs.existsSync(worktree)) await runAsync("npm", ["run", "-s", "instances", "--", "new", name, ...baseArgs], repoRoot);

  // Start the worker inside its worktree with the issue-worker role.
  const sessionId = randomUUID();
  const prompt = `${brief.trim()}\n\nYour worktree already exists and is your working directory: ${worktree}`;
  const role = ["--agent", "issue-worker", "--append-system-prompt", insideContext(name)];
  const args = ["--model", chosen, ...role, "--name", name, "--session-id", sessionId, "--permission-mode", "auto", prompt];
  const meta = { model: chosen, issue: Number(issue), sessionId, base: base ?? config.branches.trunk };
  return startSession({ name, kind: "worker", cwd: worktree, command: "claude", args, meta, busy: true });
}



// Workers and Status name issue branches the same way.
export { workerName };
