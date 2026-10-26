// Keeps the vendored kit's packages out of the project's git.
// The kit code and its manifest stay committed.

import fs from "node:fs";
import path from "node:path";
import { KIT_FOLDER } from "../../config/defaults.mjs";

/** Line the kit adds to .gitignore. */
export const IGNORE_LINE = `${KIT_FOLDER}/node_modules/`;

/** Existing lines that already ignore every node_modules. */
const COVERING = /^(\*\*\/)?node_modules\/?$/;



/**
 * Adds the kit's ignore line unless something covers it.
 *
 * Purpose: Never commit node-pty builds or xterm packages.
 *
 * @param text Current .gitignore text, or an empty string.
 * @returns New text, and whether it changed.
 */
export function mergeGitignore(text) {
  // An unanchored node_modules rule already covers the kit.
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  if (lines.some((line) => COVERING.test(line) || line === IGNORE_LINE || line === `/${IGNORE_LINE}`)) return { text, changed: false };
  const separator = text && !text.endsWith("\n") ? "\n" : "";
  return { text: `${text}${separator}${IGNORE_LINE}\n`, changed: true };
}



/**
 * Applies the ignore line to the project's .gitignore.
 *
 * Purpose: Keep installs out of commits from day one.
 *
 * @param projectRoot Project checkout root.
 * @returns Whether .gitignore changed.
 *
 * Side effects: Creates or appends to .gitignore.
 */
export function applyGitignore(projectRoot) {
  // Missing files start empty.
  const file = path.join(projectRoot, ".gitignore");
  const merged = mergeGitignore(fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "");
  if (merged.changed) fs.writeFileSync(file, merged.text);
  return { changed: merged.changed };
}
