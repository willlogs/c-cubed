// Adds the kit's npm scripts to the root package.json.
// Skills call them, so every project has the same commands.

import fs from "node:fs";
import path from "node:path";
import { KIT_FOLDER } from "../../config/defaults.mjs";

/** Scripts every project gets, by name. */
export const KIT_SCRIPTS = {
  "command-center": `npm --prefix ${KIT_FOLDER} start --silent`,
  cc: `node ${KIT_FOLDER}/cli/cc.mjs`,
  status: `node ${KIT_FOLDER}/cli/status.mjs`,
  instances: `node ${KIT_FOLDER}/instances/cli.mjs`,
};



/**
 * Adds kit scripts to a parsed package.json.
 *
 * Purpose: Never overwrite a project script of the same name.
 *
 * @param pkg Parsed package.json, or null when absent.
 * @param name Package name to use when creating one.
 * @returns Package, added script names, and conflicts.
 */
export function mergeScripts(pkg, name) {
  // A missing package.json becomes a minimal private one.
  const base = pkg ?? { name, private: true };
  const scripts = { ...base.scripts };
  const result = { added: [], conflicts: [] };

  // Equal scripts are fine; different ones are reported.
  for (const [script, command] of Object.entries(KIT_SCRIPTS)) {
    if (scripts[script] === undefined) {
      scripts[script] = command;
      result.added.push(script);
    } else if (scripts[script] !== command) {
      result.conflicts.push(`package.json script "${script}" differs from the kit's (${command}); left as is.`);
    }
  }
  return { pkg: { ...base, scripts }, ...result };
}



/**
 * Turns a folder name into a valid package name.
 *
 * Purpose: Name a package.json the kit creates.
 *
 * @param folder Project folder name.
 * @returns Lowercase name of letters, digits, and dashes.
 */
export function packageName(folder) {
  // npm names are lowercase without spaces.
  return String(folder).toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^[-._]+|-+$/g, "") || "project";
}



/**
 * Applies the kit scripts to the project's package.json.
 *
 * Purpose: Make npm run cc and friends work everywhere.
 *
 * @param projectRoot Project checkout root.
 * @returns Whether it changed, created, added names, conflicts.
 *
 * Side effects: Creates or rewrites package.json.
 */
export function applyScripts(projectRoot) {
  // A broken package.json is the project's to fix.
  const file = path.join(projectRoot, "package.json");
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  let pkg = null;
  try {
    pkg = text === null ? null : JSON.parse(text);
  } catch (error) {
    return { changed: false, created: false, added: [], conflicts: [`package.json is not valid JSON (${error.message}); left as is.`] };
  }

  // Keep the file's own indentation when rewriting.
  const merged = mergeScripts(pkg, packageName(path.basename(projectRoot)));
  if (!merged.added.length) return { changed: false, created: false, added: [], conflicts: merged.conflicts };
  const indent = /^\{\r?\n([ \t]+)"/.exec(text ?? "")?.[1] ?? 2;
  fs.writeFileSync(file, `${JSON.stringify(merged.pkg, null, indent)}\n`);
  return { changed: true, created: text === null, added: merged.added, conflicts: merged.conflicts };
}
