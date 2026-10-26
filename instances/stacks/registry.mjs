// Records running stacks: worktree, branch, ports, and process.
// One locked file per project, in the shared state folder.

import fs from "node:fs";
import path from "node:path";
import { stateDir } from "../../config/paths.mjs";

/** How long to wait for another writer's lock. */
const LOCK_WAIT_MS = 10_000;

/** A lock older than this was left by a crash. */
const STALE_LOCK_MS = 30_000;



/**
 * Returns the folder holding stack records and logs.
 *
 * Purpose: One place for every stack file.
 *
 * Inputs: None.
 *
 * @returns Absolute folder path; may not exist yet.
 */
export function stacksDir() {
  // Shared by every worktree of the project.
  return path.join(stateDir(), "stacks");
}



/**
 * Builds an empty registry.
 *
 * Purpose: Give the first start a stable shape.
 *
 * Inputs: None.
 *
 * @returns Registry with no stacks.
 */
export function emptyRegistry() {
  // Stacks are keyed by name.
  return { instances: {} };
}



/**
 * Reads the registry from disk.
 *
 * Purpose: Let every caller see the latest records.
 *
 * Inputs: None.
 *
 * @returns Parsed registry, or an empty one.
 */
export function readRegistry() {
  // A missing or broken file means no stacks.
  try {
    return { ...emptyRegistry(), ...JSON.parse(fs.readFileSync(path.join(stacksDir(), "registry.json"), "utf8")) };
  } catch {
    return emptyRegistry();
  }
}



/**
 * Updates the registry under a lock.
 *
 * Purpose: Keep concurrent agents from taking the same ports.
 *
 * @param change Function receiving and returning the registry.
 * @returns Promise resolving with the saved registry.
 *
 * Side effects: Rewrites registry.json atomically.
 */
export async function updateRegistry(change) {
  // Hold the lock while reading, changing, and writing.
  fs.mkdirSync(stacksDir(), { recursive: true });
  const lock = path.join(stacksDir(), "registry.lock");
  await acquireLock(lock);
  try {
    // Write a temporary file, then rename over the old one.
    const next = await change(readRegistry());
    const file = path.join(stacksDir(), "registry.json");
    fs.writeFileSync(`${file}.tmp`, `${JSON.stringify(next, null, 2)}\n`);
    fs.renameSync(`${file}.tmp`, file);
    return next;
  } finally {
    fs.rmSync(lock, { recursive: true, force: true });
  }
}



/**
 * Takes a folder lock, waiting for other holders.
 *
 * Purpose: mkdir is atomic, so no package is needed.
 *
 * @param lock Lock folder path.
 * @returns Promise resolving once the lock is held.
 *
 * Side effects: Creates the lock folder; removes stale ones.
 */
async function acquireLock(lock) {
  // Retry until the deadline, clearing locks left by crashes.
  const deadline = Date.now() + LOCK_WAIT_MS;
  for (;;) {
    try {
      fs.mkdirSync(lock);
      return;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      if (Date.now() - fs.statSync(lock, { throwIfNoEntry: false })?.mtimeMs > STALE_LOCK_MS) fs.rmSync(lock, { recursive: true, force: true });
      if (Date.now() > deadline) throw new Error(`Stack registry stayed locked: ${lock}`);
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
}
