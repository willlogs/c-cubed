// Copies the kit's code into a project's tools/command-center.
// Keeps installed packages; reinstalls only when the lockfile changed.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { MANIFEST_FILE } from "./manifest.mjs";

/** Names never copied, wherever they appear. */
const SKIPPED_NAMES = new Set(["node_modules", ".git", "__pycache__", MANIFEST_FILE]);

/** Lockfile whose change triggers a package install. */
const LOCKFILE = "package-lock.json";



/**
 * Tells whether two folders are the same place.
 *
 * Purpose: Skip copying when rendering from the vendored kit.
 *
 * @param first One folder.
 * @param second Another folder.
 * @returns True when both resolve to one real path.
 */
export function sameFolder(first, second) {
  // Missing folders cannot be the same place.
  if (!fs.existsSync(first) || !fs.existsSync(second)) return false;
  return fs.realpathSync(first) === fs.realpathSync(second);
}



/**
 * Tells whether a kit path belongs in the copy.
 *
 * Purpose: Leave packages, git data, and caches behind.
 *
 * @param source Absolute path about to be copied.
 * @returns True when the path is copied.
 */
function shouldCopy(source) {
  // Names are skipped wherever they appear.
  return !SKIPPED_NAMES.has(path.basename(source));
}



/**
 * Reads a file's text, or null when absent.
 *
 * Purpose: Compare lockfiles before and after a copy.
 *
 * @param file File path.
 * @returns File text, or null.
 */
function readOptional(file) {
  // Absent files compare as null.
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
}



/**
 * Replaces the vendored kit with a fresh copy.
 *
 * Purpose: Install or update the kit's code in a project.
 *
 * @param kitRoot Kit root to copy from.
 * @param destination The project's tools/command-center folder.
 * @param options installPackages: run npm ci when needed.
 * @returns Whether it copied, and whether packages installed.
 *
 * Side effects: Deletes and writes files; may run npm ci.
 */
export function copyKit(kitRoot, destination, { installPackages = true } = {}) {
  // Rendering from the vendored copy needs no copy.
  if (sameFolder(kitRoot, destination)) return { copied: false, installed: false, installNeeded: false, attempted: false };
  const lockBefore = readOptional(path.join(destination, LOCKFILE));

  // Clear the old copy, keeping packages and the manifest.
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(destination)) {
    if (entry === "node_modules" || entry === MANIFEST_FILE) continue;
    fs.rmSync(path.join(destination, entry), { recursive: true, force: true });
  }

  // Copy the kit, links kept as links.
  fs.cpSync(kitRoot, destination, { recursive: true, verbatimSymlinks: true, filter: (source) => shouldCopy(source) });

  // Install only when packages are missing or changed.
  const lockAfter = readOptional(path.join(destination, LOCKFILE));
  const missing = !fs.existsSync(path.join(destination, "node_modules"));
  const needed = Boolean(lockAfter) && (missing || lockAfter !== lockBefore);
  if (!installPackages || !needed) return { copied: true, installed: false, installNeeded: needed, attempted: false };
  return { copied: true, installed: installKitPackages(destination), installNeeded: needed, attempted: true };
}



/**
 * Runs npm ci in the vendored kit folder.
 *
 * Purpose: The server needs node-pty, xterm, and ws.
 *
 * @param destination The project's tools/command-center folder.
 * @returns True when the install succeeded.
 *
 * Side effects: Writes node_modules; prints npm errors.
 */
function installKitPackages(destination) {
  // Errors stay visible; the summary reports failure.
  const args = ["ci", "--no-audit", "--no-fund", "--loglevel=error"];
  const result = spawnSync("npm", args, { cwd: destination, stdio: ["ignore", "ignore", "inherit"] });
  return result.status === 0;
}
