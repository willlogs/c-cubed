// Reports which stacks run and whether they answer.
// Feeds npm run status, the instances CLI, and Status.

import { loadConfig } from "../../config/load.mjs";
import { expandCommand, processAlive, runShell } from "./commands.mjs";
import { portFree } from "./ports.mjs";
import { readRegistry } from "./registry.mjs";



/**
 * Summarizes one stack's health in one word.
 *
 * Purpose: Show running or degraded at a glance.
 *
 * @param record Stack record.
 * @param settings Stacks settings.
 * @returns Promise resolving with running or degraded.
 */
export async function stackState(record, settings) {
  // A dead background process is degraded at once.
  if (record.pid && !processAlive(record.pid)) return "degraded";
  if (settings?.health) return runShell(settings.health, record, { timeoutMs: 5000, quiet: true }).then(() => "running", () => "degraded");

  // Otherwise the first port must answer.
  const first = Object.values(record.ports ?? {})[0];
  if (!first) return "running";
  return (await portFree(first)) ? "degraded" : "running";
}



/**
 * Builds one truthful snapshot of every stack.
 *
 * Purpose: Join recorded stacks with their live health.
 *
 * Inputs: None.
 *
 * @returns Promise resolving with settings and stacks.
 */
export async function describeStatus() {
  // Probe every recorded stack side by side.
  const settings = loadConfig().stacks;
  const records = Object.values(readRegistry().instances);
  const instances = await Promise.all(records.map(async (record) => ({
    ...record, state: await stackState(record, settings), url: settings?.url ? expandCommand(settings.url, record) : null,
  })));
  return { configured: Boolean(settings?.start), max: settings?.max ?? 0, instances };
}



/**
 * Prints connection details for one started stack.
 *
 * Purpose: Show an agent where its app answers.
 *
 * @param record Stack that just started.
 * @returns No value.
 */
export function printRecord(record) {
  // Ports by name, then where it runs from.
  const settings = loadConfig().stacks;
  console.log(`Stack ${record.name}`);
  for (const [key, port] of Object.entries(record.ports ?? {})) console.log(`  ${key.padEnd(8)} http://127.0.0.1:${port}`);
  if (settings?.url) console.log(`  open     ${expandCommand(settings.url, record)}`);
  console.log(`  branch   ${record.branch}`);
  console.log(`  tree     ${record.worktree}`);
  console.log(`  logs     npm run instances -- logs ${record.name}`);
}



/**
 * Prints every stack with its live state.
 *
 * Purpose: Answer "what is running?" without guessing.
 *
 * Inputs: None.
 *
 * @returns Promise resolving after printing.
 */
export async function printStatus() {
  // Projects without stacks say so in one line.
  const status = await describeStatus();
  if (!status.configured) return console.log("Stacks: not used by this project.");
  console.log(`Stacks: ${status.instances.length} of ${status.max} allowed`);
  for (const item of status.instances) {
    const ports = Object.entries(item.ports ?? {}).map(([key, port]) => `${key} ${port}`).join("  ");
    console.log(`  ${item.name}  ${item.state}  ${ports}`);
  }
  return undefined;
}
