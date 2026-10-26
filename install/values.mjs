// Builds the values kit templates are rendered with.
// One place maps project settings to template names.

import path from "node:path";
import { KIT_FOLDER } from "../config/defaults.mjs";



/**
 * Lists the template values for one project's settings.
 *
 * Purpose: Give every template the same names and flags.
 *
 * @param config Settings from loadConfig, with root.
 * @returns Names to strings and booleans.
 */
export function templateValues(config) {
  // Optional branches render as empty strings.
  const branches = config.branches ?? {};
  const roots = config.enforcement?.hexagonal ?? [];
  const folder = path.basename(config.root ?? process.cwd());
  const staging = branches.staging ?? "";
  const production = branches.production ?? "";

  // Plain values first, then flags for conditional blocks.
  return {
    project: config.project || folder,
    owner: config.owner || "the owner",
    trunk: branches.trunk ?? "main",
    staging,
    production,
    decisions: config.decisions,
    kitFolder: KIT_FOLDER,
    worktrees: `../${folder}-wt`,
    maxWorkers: String(config.workers?.max ?? ""),
    port: String(config.port ?? ""),
    model: config.workers?.model ?? "",
    hasStaging: Boolean(staging),
    hasProduction: Boolean(production),
    hasStacks: Boolean(config.stacks),
    hasVersions: Boolean(config.versions?.file),
    hexagonal: roots.length > 0,
    readableCode: Boolean(config.enforcement?.readableCode),
    hexagonalRoots: roots.join(", "),
  };
}
