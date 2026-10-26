// Classifies findings as new, touched, or pre-existing.
// Hides untouched legacy findings during change-scoped runs.

import fs from 'node:fs';
import path from 'node:path';



/**
 * Classifies a finding by its changed line span.
 *
 * Purpose: Separate new code from partially edited legacy code.
 *
 * @param {object} finding Positioned architecture finding.
 * @param {object} changes Changed files and added lines.
 * @returns {string|undefined} "new", "touched", or hidden.
 */
function spanScope(finding, changes) {
  // New files make every finding new.
  const change = changes.files.get(finding.file);
  if (!change) return undefined;
  if (change.status === 'new') return 'new';

  // Count added lines inside the finding's span.
  let added = 0;
  for (let line = finding.spanStart; line <= finding.spanEnd; line += 1) {
    if (change.added.has(line)) added += 1;
  }
  if (!added) return undefined;
  return added === finding.spanEnd - finding.spanStart + 1 ? 'new' : 'touched';
}



/**
 * Lists every file below one directory.
 *
 * Purpose: Decide whether a whole module is new.
 *
 * @param {string} directory Absolute directory to walk.
 * @returns {Array<string>} Absolute file paths.
 */
function listFiles(directory) {
  // Recurse through subfolders, ignoring unreadable paths.
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(file) : [file];
  });
}



/**
 * Checks whether every file of a module is new.
 *
 * Purpose: Mark findings in brand-new modules as new.
 *
 * @param {string} base Absolute module folder.
 * @param {object} changes Changed files and added lines.
 * @param {Map<string, boolean>} cache Results keyed by module folder.
 * @returns {boolean} Whether the module is entirely new.
 */
function isModuleNew(base, changes, cache) {
  // Walk each module folder once per run.
  if (!cache.has(base)) {
    const files = listFiles(base);
    const isNew = files.length > 0
      && files.every((file) => changes.files.get(file)?.status === 'new');
    cache.set(base, isNew);
  }
  return cache.get(base);
}



/**
 * Classifies a module-level finding.
 *
 * Purpose: Show module findings whenever that module changed.
 *
 * @param {object} finding Finding carrying module information.
 * @param {object} changes Changed files and added lines.
 * @param {Map<string, boolean>} cache Module newness cache.
 * @returns {string|undefined} "new", "touched", or hidden.
 */
function moduleScope(finding, changes, cache) {
  // Any changed, added, or deleted module file counts.
  const prefix = `${finding.module.base}${path.sep}`;
  const paths = [...changes.files.keys(), ...changes.deleted];
  if (!paths.some((file) => file.startsWith(prefix))) return undefined;

  // New modules and newly written contracts are new.
  if (isModuleNew(finding.module.base, changes, cache)) return 'new';
  return spanScope(finding, changes) === 'new' ? 'new' : 'touched';
}



/**
 * Splits findings into shown and hidden sets.
 *
 * Purpose: Report only what the current change introduced.
 *
 * @param {Array<object>} findings All findings for one root.
 * @param {object} changes Changed files and added lines.
 * @returns {object} Shown findings with scope, hidden count.
 */
export function scopeFindings(findings, changes) {
  // Classify each finding against the change set.
  const cache = new Map();
  const shown = [];
  let hidden = 0;
  for (const finding of findings) {
    const scope = finding.module
      ? moduleScope(finding, changes, cache)
      : spanScope(finding, changes);
    if (scope) shown.push({ ...finding, scope });
    else hidden += 1;
  }
  return { shown, hidden };
}
