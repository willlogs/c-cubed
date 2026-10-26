#!/usr/bin/env node
// Coordinates the complete TypeScript architecture audit.
// Keeps command handling separate from reusable rules.

import process from 'node:process';
import { auditRoot } from './lib/audit/run.mjs';
import { printLegend } from './lib/cli/legend.mjs';
import { parseOptions, USAGE } from './lib/cli/options.mjs';
import { printRootResult } from './lib/cli/output.mjs';
import { findAppRoots, normalize } from './lib/project/locations.mjs';
import { scopeFindings } from './lib/scope/classify.mjs';
import { collectChanges } from './lib/scope/git.mjs';



/**
 * Chooses application roots for this run.
 *
 * Purpose: Support explicit, changed-file, and default roots.
 *
 * @param {object} options Parsed command options.
 * @param {object|undefined} changes Changed files when scoping.
 * @returns {Array<string>} Application roots to audit.
 */
function selectRoots(options, changes) {
  // Prefer explicit roots, then changed-file discovery.
  if (options.root) return [normalize(options.root)];
  if (changes) return findAppRoots(changes, options);
  return [normalize(process.cwd())];
}



/**
 * Audits one root and prints its outcome.
 *
 * Purpose: Apply optional change scoping before reporting.
 *
 * @param {string} root Application root directory.
 * @param {object} options Parsed command options.
 * @param {object|undefined} changes Changed files when scoping.
 * @param {Set<string>} rules Mutable set of shown rule ids.
 * @returns {number} Exit code for this root.
 */
function auditAndReport(root, options, changes, rules) {
  // Collect every finding before deciding visibility.
  const result = auditRoot(root, options);
  if (result.error) {
    console.error(result.error);
    return 2;
  }

  // Hide untouched legacy findings when scoping changes.
  const scoped = changes
    ? scopeFindings(result.findings, changes)
    : { shown: result.findings, hidden: undefined };
  for (const finding of scoped.shown) rules.add(finding.rule);
  printRootResult(result, scoped);
  return scoped.shown.length ? 1 : 0;
}



/**
 * Runs the complete architecture audit.
 *
 * Purpose: Coordinate options, change scope, roots, and exit status.
 *
 * Inputs: None.
 * @returns {number} Exit code: 0 pass, 1 violations, 2 setup.
 */
function main() {
  // Parse options and report invalid usage.
  const options = parseOptions(process.argv.slice(2));
  if (options.help) {
    console.log(USAGE);
    return 0;
  }
  if (options.error) {
    console.error(`${options.error}\n${USAGE}`);
    return 2;
  }

  // Load changed files when the run is scoped.
  const scoped = options.changed || Boolean(options.since);
  const changes = scoped ? collectChanges(options) : undefined;
  if (changes?.error) {
    console.error(changes.error);
    return 2;
  }
  const roots = selectRoots(options, changes);
  if (!roots.length) {
    console.log('Architecture passed: no changed files belong to an application root.');
    return 0;
  }

  // Audit each root and keep the strongest exit code.
  const rules = new Set();
  const codes = roots.map((root) => auditAndReport(root, options, changes, rules));
  printLegend(rules);
  return Math.max(...codes);
}



// Exit with the deterministic audit result.
process.exitCode = main();
