// Keeps the kit rules block in AGENTS.md current.
// Text outside the markers is the project's, never changed.

import fs from "node:fs";
import path from "node:path";
import { renderText } from "../template/engine.mjs";

/** Marker lines around the kit-owned block. */
export const MARKERS = { start: "<!-- command-center:rules:start -->", end: "<!-- command-center:rules:end -->" };

/** Explains the block when appended to an existing file. */
const NOTE = "<!-- The command center keeps the block below current. Edit outside it. -->";



/**
 * Puts the kit block into AGENTS.md text.
 *
 * Purpose: Replace between markers, or append when none exist.
 *
 * @param text Current AGENTS.md text.
 * @param block Rendered kit rules.
 * @returns New text, whether it changed, and any conflict.
 */
export function mergeAgentsBlock(text, block) {
  // The block sits on its own lines between the markers.
  const wrapped = `${MARKERS.start}\n${block.trim()}\n${MARKERS.end}`;
  const start = text.indexOf(MARKERS.start);
  const end = text.indexOf(MARKERS.end);

  // One marker alone means someone edited them; leave it.
  if ((start < 0) !== (end < 0) || end < start) {
    return { text, changed: false, conflict: "AGENTS.md has only one rules marker, or they are out of order; left as is." };
  }

  // No markers yet: append the block after a note.
  if (start < 0) {
    const next = `${text.trimEnd()}\n\n${NOTE}\n${wrapped}\n`;
    return { text: next, changed: true, conflict: null };
  }

  // Markers present: replace only what lies between them.
  const next = `${text.slice(0, start)}${wrapped}${text.slice(end + MARKERS.end.length)}`;
  return { text: next, changed: next !== text, conflict: null };
}



/**
 * Updates the project's AGENTS.md with the rendered kit rules.
 *
 * Purpose: Ship rule changes with every kit update.
 *
 * @param kitRoot Kit root holding templates/blocks.
 * @param projectRoot Project checkout root.
 * @param values Template values.
 * @returns Whether AGENTS.md changed, and any conflict.
 *
 * Side effects: Creates or rewrites AGENTS.md.
 */
export function applyAgentsBlock(kitRoot, projectRoot, values) {
  // A kit without the block has nothing to merge.
  const source = path.join(kitRoot, "templates", "blocks", "agents-rules.md");
  if (!fs.existsSync(source)) return { changed: false, conflict: "The kit has no templates/blocks/agents-rules.md; AGENTS.md left as is." };
  const block = renderText(fs.readFileSync(source, "utf8"), values);

  // A project without AGENTS.md gets a minimal one.
  const file = path.join(projectRoot, "AGENTS.md");
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : `# ${values.project} agent rules\n`;
  const merged = mergeAgentsBlock(text, block);
  if (merged.changed || !fs.existsSync(file)) fs.writeFileSync(file, merged.text);
  return { changed: merged.changed, conflict: merged.conflict };
}
