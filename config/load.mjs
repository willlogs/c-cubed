// Reads command-center.json and fills in the defaults.
// Every server, CLI, and hook setting comes through here.

import fs from "node:fs";
import path from "node:path";
import { CONFIG_FILE, DEFAULTS, STACK_DEFAULTS } from "./defaults.mjs";
import { checkoutRoot, mainCheckout } from "./paths.mjs";

/** Loaded settings and file stamps, by checkout root. */
const cache = new Map();



/**
 * Merges settings onto defaults, key by key.
 *
 * Purpose: Let a project set only what differs.
 *
 * @param base Default values.
 * @param override Values from the file.
 * @returns New merged object.
 */
export function mergeSettings(base, override) {
  // Plain objects merge; anything else replaces.
  const merged = { ...base };
  for (const [key, value] of Object.entries(override ?? {})) {
    const nested = isPlainObject(value) && isPlainObject(base?.[key]);
    merged[key] = nested ? mergeSettings(base[key], value) : value;
  }
  return merged;
}



/**
 * Tells whether a value is a plain object.
 *
 * Purpose: Merge objects but replace arrays and null.
 *
 * @param value Any value.
 * @returns True for objects that are not arrays.
 */
function isPlainObject(value) {
  // Arrays and null are objects too; exclude them.
  return value !== null && typeof value === "object" && !Array.isArray(value);
}



/**
 * Reads the raw settings file of one checkout.
 *
 * Purpose: Tell "no file yet" apart from a broken one.
 *
 * @param root Checkout root.
 * @returns Parsed file, or null when absent.
 */
export function readConfigFile(root) {
  // A broken file must fail loudly, not fall back.
  const file = path.join(root, CONFIG_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`${CONFIG_FILE} is not valid JSON: ${error.message}`);
  }
}



/**
 * Loads one checkout's settings with defaults filled in.
 *
 * Purpose: One settings object for every kit part.
 *
 * @param root Checkout root; the main checkout by default.
 * @param fresh Whether to reread the file.
 * @returns Settings, plus root and whether the file exists.
 */
export function loadConfig(root = mainCheckout(), fresh = false) {
  // Serve the cached copy until the file changes.
  const stamp = fileStamp(root);
  const cached = cache.get(root);
  if (!fresh && cached && cached.stamp === stamp) return cached.config;
  const file = readConfigFile(root);
  const config = mergeSettings(DEFAULTS, file ?? {});

  // A stacks block gets its own defaults.
  if (config.stacks) config.stacks = mergeSettings(STACK_DEFAULTS, config.stacks);
  const loaded = { ...config, root, exists: Boolean(file), ownerName: config.owner || "the owner" };
  cache.set(root, { stamp, config: loaded });
  return loaded;
}



/**
 * Returns when the settings file last changed.
 *
 * Purpose: Running servers see setup's edits at once.
 *
 * @param root Checkout root.
 * @returns Modification time in ms, or 0 when absent.
 */
function fileStamp(root) {
  // A missing file has no stamp.
  return fs.statSync(path.join(root, CONFIG_FILE), { throwIfNoEntry: false })?.mtimeMs ?? 0;
}



/**
 * Loads the settings of the checkout a folder is in.
 *
 * Purpose: Checks use the branch's own settings.
 *
 * @param from Folder inside a checkout or worktree.
 * @returns Settings for that checkout.
 */
export function loadLocalConfig(from = process.cwd()) {
  // A pull request may change the settings it runs under.
  return loadConfig(checkoutRoot(from));
}



/**
 * Writes settings back, keeping keys the file already had.
 *
 * Purpose: Let setup and the CLI change settings safely.
 *
 * @param root Checkout root.
 * @param change Function receiving and returning the raw file.
 * @returns The written raw settings.
 *
 * Side effects: Rewrites command-center.json; clears the cache.
 */
export function updateConfigFile(root, change) {
  // Only file keys are written, never filled defaults.
  const next = change(readConfigFile(root) ?? {});
  fs.writeFileSync(path.join(root, CONFIG_FILE), `${JSON.stringify(next, null, 2)}\n`);
  cache.delete(root);
  return next;
}
