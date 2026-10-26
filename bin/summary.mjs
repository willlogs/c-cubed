// Prints what an install wrote, merged, kept, and left alone.
// Plain lines, so people and agents read the same thing.

import { KIT_FOLDER } from "../config/defaults.mjs";



/**
 * Describes the kit copy step in a few words.
 *
 * Purpose: Say whether packages still need installing.
 *
 * @param kit Copy result, or undefined for a render.
 * @returns Short description.
 */
function kitLine(kit) {
  // Renders reuse the vendored copy.
  if (!kit?.copied) return `${KIT_FOLDER} reused as is`;
  if (kit.attempted) return `copied to ${KIT_FOLDER}; packages ${kit.installed ? "installed" : "FAILED to install"}`;
  return `copied to ${KIT_FOLDER}${kit.installNeeded ? `; run npm ci in ${KIT_FOLDER} before starting` : ""}`;
}



/**
 * Joins a list, or says none.
 *
 * Purpose: Keep summary lines short and readable.
 *
 * @param items Strings to list.
 * @returns Comma-separated list, or "none".
 */
function list(items = []) {
  // Empty lists read as none.
  return items.length ? items.join(", ") : "none";
}



/**
 * Prints an install summary.
 *
 * Purpose: Show the owner what changed in the project.
 *
 * @param summary Summary from installKit.
 * @returns No value.
 *
 * Side effects: Writes to standard output.
 */
export function printSummary(summary) {
  // One line per step, in the order they ran.
  const { templates, links, scaffold, agents, settings, scripts, gitignore } = summary;
  const lines = [
    `Kit: ${kitLine(summary.kit)}`,
    `command-center.json: ${summary.configCreated ? "created" : "kept"}`,
    `Kit files: ${templates.written.length} written, ${templates.unchanged} unchanged, ${templates.removed.length} removed`,
    `Skill links: ${links.created.length} created, ${links.removed.length} removed`,
    scaffold && `Project files written: ${list(scaffold.written)}`,
    scaffold && `Project files kept: ${list(scaffold.skipped)}`,
    `AGENTS.md rules block: ${agents.changed ? "updated" : "current"}`,
    `.claude/settings.json: ${settings.changed ? "merged" : "current"}`,
    scripts && `package.json scripts added: ${list(scripts.added)}${scripts.created ? " (package.json created)" : ""}`,
    gitignore && `.gitignore: ${gitignore.changed ? "kit packages ignored" : "current"}`,
  ];
  console.log(lines.filter(Boolean).join("\n"));

  // Conflicts last, so they are the thing people see.
  if (summary.conflicts.length) console.log(`\nLeft as is:\n${summary.conflicts.map((item) => `  - ${item}`).join("\n")}`);
}
