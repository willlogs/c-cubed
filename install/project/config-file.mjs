// Writes a project's first command-center.json from init's answers.
// Only values that differ from the defaults are written.

import path from "node:path";
import { DEFAULTS } from "../../config/defaults.mjs";
import { readConfigFile, updateConfigFile } from "../../config/load.mjs";
import { detectChecks, detectHexagonalRoots, detectInstaller, detectOwner, detectTrunk } from "./detect.mjs";



/**
 * Lists init's defaults for a project.
 *
 * Purpose: Offer good answers before asking anything.
 *
 * @param root Project checkout root.
 * @returns Project name, owner, and trunk guesses.
 */
export function defaultAnswers(root) {
  // The folder name is the usual project name.
  return { project: path.basename(root), owner: detectOwner(root), trunk: detectTrunk(root) };
}



/**
 * Builds the first settings file from answers and detection.
 *
 * Purpose: Keep the written file short and readable.
 *
 * @param root Project checkout root.
 * @param answers Project, owner, trunk, and optional kit source.
 * @returns Raw settings object to save.
 */
export function initialConfig(root, answers) {
  // Identity and setup state are always written.
  const raw = { project: answers.project, owner: answers.owner, branches: { trunk: answers.trunk } };

  // Worktree setup follows the project's lockfile.
  const installer = detectInstaller(root);
  const worktrees = { setup: installer ? [installer.setup] : [], lockfiles: installer ? [installer.lockfile] : [] };
  if (!sameValue(worktrees, DEFAULTS.worktrees)) raw.worktrees = worktrees;

  // Checks and hexagonal roots only when found.
  const checks = detectChecks(root);
  if (checks.length) raw.checks = checks;
  const hexagonal = detectHexagonalRoots(root);
  if (hexagonal.length) raw.enforcement = { hexagonal };

  // A chosen kit source is remembered for updates.
  const kit = { source: answers.source ?? DEFAULTS.kit.source, ref: answers.ref ?? DEFAULTS.kit.ref };
  if (!sameValue(kit, DEFAULTS.kit)) raw.kit = kit;
  return raw;
}



/**
 * Compares two plain values by their JSON.
 *
 * Purpose: Leave defaults out of the written file.
 *
 * @param first One value.
 * @param second Another value.
 * @returns True when both serialize the same.
 */
function sameValue(first, second) {
  // Key order matches because both come from literals.
  return JSON.stringify(first) === JSON.stringify(second);
}



/**
 * Writes command-center.json unless the project has one.
 *
 * Purpose: Never overwrite settings setup already refined.
 *
 * @param root Project checkout root.
 * @param answers Project, owner, trunk, and optional kit source.
 * @returns True when the file was created.
 *
 * Side effects: Writes command-center.json.
 */
export function writeInitialConfig(root, answers) {
  // An existing file is the project's; leave it.
  if (readConfigFile(root)) return false;
  updateConfigFile(root, () => initialConfig(root, answers));
  return true;
}
