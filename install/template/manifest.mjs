// Records what the kit installed, so updates clean up.
// Lives in the vendored kit folder, committed with it.

import fs from "node:fs";
import path from "node:path";
import { KIT_FOLDER } from "../../config/defaults.mjs";

/** Manifest file name inside the vendored kit folder. */
export const MANIFEST_FILE = ".installed.json";



/**
 * Builds the manifest of a project with no install yet.
 *
 * Purpose: Give first installs a stable shape.
 *
 * Inputs: None.
 *
 * @returns Manifest with nothing recorded.
 */
export function emptyManifest() {
  // Every list starts empty; nothing to remove.
  return { kit: null, files: [], links: [], permissions: { allow: [], deny: [] } };
}



/**
 * Returns where a project's manifest lives.
 *
 * Purpose: Keep the path in one place.
 *
 * @param projectRoot Project checkout root.
 * @returns Absolute manifest path.
 */
export function manifestPath(projectRoot) {
  // Inside the kit folder, beside the code it describes.
  return path.join(projectRoot, KIT_FOLDER, MANIFEST_FILE);
}



/**
 * Reads a project's manifest, or an empty one.
 *
 * Purpose: Know which files and entries the kit owns.
 *
 * @param projectRoot Project checkout root.
 * @returns Manifest with every field present.
 */
export function readManifest(projectRoot) {
  // A missing or broken file means nothing is owned yet.
  const file = manifestPath(projectRoot);
  if (!fs.existsSync(file)) return emptyManifest();
  try {
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    const permissions = { ...emptyManifest().permissions, ...saved.permissions };
    return { ...emptyManifest(), ...saved, permissions };
  } catch {
    return emptyManifest();
  }
}



/**
 * Writes a project's manifest.
 *
 * Purpose: Remember ownership for the next update.
 *
 * @param projectRoot Project checkout root.
 * @param manifest Manifest to save.
 * @returns No value.
 *
 * Side effects: Writes the manifest file.
 */
export function writeManifest(projectRoot, manifest) {
  // Sorted lists keep diffs small between installs.
  const file = manifestPath(projectRoot);
  const sorted = { ...manifest, files: [...manifest.files].sort(), links: [...manifest.links].sort() };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(sorted, null, 2)}\n`);
}
