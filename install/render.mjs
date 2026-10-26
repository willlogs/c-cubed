// Re-renders kit-owned files from the vendored kit's templates.
// Runs after settings change, such as when setup ends.

import path from "node:path";
import { KIT_FOLDER } from "../config/defaults.mjs";
import { mainCheckout } from "../config/paths.mjs";
import { installKit } from "./run.mjs";



/**
 * Re-renders skills, agents, rules, and Claude settings.
 *
 * Purpose: Apply new owner, branch, or enforcement settings.
 *
 * @param projectRoot Project checkout root; the main one by default.
 * @returns Install summary for the render.
 *
 * Side effects: Rewrites kit-owned files and merged entries.
 */
export function renderKitFiles(projectRoot = mainCheckout()) {
  // The vendored kit is both the source and the destination.
  return installKit({ kitRoot: path.join(projectRoot, KIT_FOLDER), projectRoot, mode: "render" });
}
