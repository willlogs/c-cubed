// Decides whether a project still needs setup, from its files.
// Builtins only, so the CLI works without the server.

import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "./load.mjs";

/** Marker the templates leave where setup must write. */
const PLACEHOLDER = "<!-- setup:";

/** Marker around the kit's rules inside AGENTS.md. */
const RULES_MARKER = "<!-- command-center:rules:start -->";



/**
 * Tells whether the project has not finished setup.
 *
 * Purpose: Pick setup mode or the normal day at start.
 *
 * @param repoRoot Main checkout path.
 * @returns True while rules or decisions are missing.
 */
export function needsSetup(repoRoot) {
  // Files decide, so fresh clones of set-up repos are ready.
  return setupProblems(repoRoot).length > 0;
}



/**
 * Lists what still blocks the end of setup.
 *
 * Purpose: Refuse to start work on missing rules.
 *
 * @param repoRoot Main checkout path.
 * @returns Problem sentences; empty when setup may end.
 */
export function setupProblems(repoRoot) {
  // Settings must name the project and its owner.
  const config = loadConfig(repoRoot, true);
  const problems = [];
  if (!config.exists) problems.push("command-center.json is missing.");
  if (!config.owner) problems.push("command-center.json names no owner.");
  if (!config.project) problems.push("command-center.json names no project.");

  // Rules must be filled in and carry the kit block.
  const agents = readText(repoRoot, "AGENTS.md");
  if (agents === null) problems.push("AGENTS.md is missing.");
  else if (agents.includes(PLACEHOLDER)) problems.push("AGENTS.md still has setup placeholders.");
  else if (!agents.includes(RULES_MARKER)) problems.push("AGENTS.md lacks the kit rules block; run npm run cc -- render.");

  // The owner must have accepted founding decisions.
  const register = readText(repoRoot, config.decisions);
  if (register === null) problems.push(`${config.decisions} is missing.`);
  else if (!/^\|\s*D\d+\s*\|/m.test(register)) problems.push(`${config.decisions} has no accepted decisions yet.`);
  return problems;
}



/**
 * Reads a project file, or null when it is absent.
 *
 * Purpose: Report missing files as problems, not crashes.
 *
 * @param repoRoot Main checkout path.
 * @param file Path relative to the checkout.
 * @returns File text, or null.
 */
function readText(repoRoot, file) {
  // Absent files are a normal setup state.
  const full = path.join(repoRoot, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}



/**
 * Refuses to end setup while anything is missing.
 *
 * Purpose: One check for the page and the CLI.
 *
 * @param repoRoot Main checkout path.
 * @returns No value; throws listing what is missing.
 */
export function assertSetupComplete(repoRoot) {
  // Each problem is one line the setup session can fix.
  const problems = setupProblems(repoRoot);
  if (problems.length) throw new Error(`Setup is not finished:\n- ${problems.join("\n- ")}`);
}
