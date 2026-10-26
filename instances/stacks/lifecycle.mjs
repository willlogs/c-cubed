// Starts and stops one worktree's app stack with project commands.
// Records ports and processes so Status and the CLI agree.

import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../../config/load.mjs";
import { gitBranch } from "../worktree/git.mjs";
import { assertDevelopmentHost, assertInstanceName } from "../names.mjs";
import { killGroup, processAlive, runShell, spawnDetached } from "./commands.mjs";
import { choosePorts, waitForPort } from "./ports.mjs";
import { readRegistry, stacksDir, updateRegistry } from "./registry.mjs";

/** How long a stack may take to become healthy. */
const START_MS = 120_000;



/**
 * Returns the project's stack settings, or explains their absence.
 *
 * Purpose: Fail clearly in projects without stacks.
 *
 * Inputs: None.
 *
 * @returns Stacks settings with defaults filled in.
 */
export function stackSettings() {
  // Setup decides whether a project has stacks.
  const { stacks } = loadConfig();
  if (!stacks?.start) throw new Error("This project runs no stacks; add stacks.start to command-center.json.");
  return stacks;
}



/**
 * Refuses to start a stack beyond the limit.
 *
 * Purpose: Protect host memory; name stacks to stop.
 *
 * @param registry Current stack registry.
 * @param name Stack about to start.
 * @param limit Maximum stacks at once.
 * @returns No value.
 */
export function assertCapacity(registry, name, limit = stackSettings().max) {
  // Restarting a recorded stack needs no new slot.
  const others = Object.keys(registry.instances).filter((item) => item !== name);
  if (others.length < limit) return;
  throw new Error(`${others.length} stacks already run (${others.join(", ")}); limit is ${limit}. Stop one with: npm run instances -- down <name>`);
}



/**
 * Starts or reuses one named stack.
 *
 * Purpose: Give an agent its own running app.
 *
 * @param name Stack name, usually the worktree name.
 * @param worktree Folder the stack runs from.
 * @returns Promise resolving with the saved record.
 *
 * Side effects: Runs project commands; may spawn processes.
 */
export async function startStack(name, worktree) {
  // Check the host, name, and limit before anything runs.
  assertDevelopmentHost();
  assertInstanceName(name);
  const settings = stackSettings();
  assertCapacity(readRegistry(), name, settings.max);
  const record = await claimRecord(name, path.resolve(worktree), settings.ports);

  // A failed start leaves nothing recorded or running.
  try {
    await launch(settings, record);
    await waitUntilHealthy(settings, readRegistry().instances[name]);
  } catch (error) {
    await stopStack(name);
    throw error;
  }
  return readRegistry().instances[name];
}



/**
 * Runs the start command the way the settings ask.
 *
 * Purpose: Support self-managing and long-running commands.
 *
 * @param settings Stacks settings.
 * @param record Claimed stack record.
 * @returns Promise resolving once the command is launched.
 *
 * Side effects: Runs or spawns the start command.
 */
async function launch(settings, record) {
  // With a stop command, start must return by itself.
  if (settings.stop) return runShell(settings.start, record);
  if (processAlive(record.pid)) return undefined;

  // Otherwise run it in the background and keep its pid.
  const pid = spawnDetached(settings.start, record, logPath(record.name));
  await updateRegistry((registry) => {
    registry.instances[record.name].pid = pid;
    return registry;
  });
  return undefined;
}



/**
 * Waits for the health command, or else the first port.
 *
 * Purpose: Report a stack started only once it answers.
 *
 * @param settings Stacks settings.
 * @param record Stack record with ports and pid.
 * @returns Promise resolving when healthy, else rejecting.
 */
async function waitUntilHealthy(settings, record) {
  // Without a health command the first port decides.
  const first = Object.values(record.ports ?? {})[0];
  if (!settings.health) return first ? waitForPort(first, START_MS) : undefined;

  // Poll the health command until it passes.
  const deadline = Date.now() + START_MS;
  while (Date.now() < deadline) {
    if (record.pid && !processAlive(record.pid)) throw new Error(`${record.name} exited while starting; see npm run instances -- logs ${record.name}`);
    if (await runShell(settings.health, record, { timeoutMs: 5000, quiet: true }).then(() => true, () => false)) return undefined;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error(`${record.name} did not pass its health command in ${START_MS / 1000}s.`);
}



/**
 * Stops one stack and frees its record.
 *
 * Purpose: Return ports and memory when work is done.
 *
 * @param name Stack name.
 * @returns Promise resolving once stopped.
 *
 * Side effects: Runs the stop command, or kills the group.
 */
export async function stopStack(name) {
  // Unknown names are already stopped.
  assertInstanceName(name);
  const record = readRegistry().instances[name];
  if (!record) return;
  const settings = loadConfig().stacks;
  if (settings?.stop) await runShell(settings.stop, record).catch((error) => console.error(error.message));
  await killGroup(record.pid);

  // Forget the stack once nothing runs.
  await updateRegistry((registry) => {
    delete registry.instances[name];
    return registry;
  });
}



/**
 * Returns the log file for a background stack.
 *
 * Purpose: One place for start output and logs.
 *
 * @param name Stack name.
 * @returns Absolute log path; its folder exists.
 */
export function logPath(name) {
  // Logs live beside the registry.
  fs.mkdirSync(stacksDir(), { recursive: true });
  return path.join(stacksDir(), `${name}.log`);
}



/**
 * Reserves ports and records one stack.
 *
 * Purpose: Keep repeated starts on the same ports.
 *
 * @param name Stack name.
 * @param worktree Absolute worktree path.
 * @param names Port names from the settings.
 * @returns Promise resolving with the stack record.
 */
async function claimRecord(name, worktree, names) {
  // Allocation happens inside the registry lock.
  const registry = await updateRegistry(async (current) => {
    // A recorded stack keeps its ports.
    const existing = current.instances[name];
    if (existing) {
      Object.assign(existing, { worktree, branch: gitBranch(worktree) });
      return current;
    }
    const taken = Object.values(current.instances).flatMap((item) => Object.values(item.ports ?? {}));
    current.instances[name] = { name, worktree, branch: gitBranch(worktree), ports: await choosePorts(names, taken), startedAt: new Date().toISOString() };
    return current;
  });
  return registry.instances[name];
}
