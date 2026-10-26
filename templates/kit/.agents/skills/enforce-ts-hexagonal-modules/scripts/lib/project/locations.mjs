// Resolves architecture locations and discovers application roots.
// Centralizes path conventions shared by every audit step.

import fs from 'node:fs';
import path from 'node:path';



/**
 * Returns a normalized absolute path.
 *
 * Purpose: Make boundary comparisons platform-safe.
 *
 * @param {string} value Path requiring normalization.
 * @returns {string} Normalized absolute path.
 */
export function normalize(value) {
  // Resolve separators and relative segments.
  return path.normalize(path.resolve(value));
}



/**
 * Builds audited locations for one application root.
 *
 * Purpose: Apply configurable folder conventions consistently.
 *
 * @param {string} root Application root as given.
 * @param {object} options Parsed command options.
 * @returns {object} Absolute root, source, module, and composition paths.
 */
export function buildLocations(root, options) {
  // Use real paths so git and compiler paths agree.
  const real = fs.existsSync(root) ? fs.realpathSync(root) : normalize(root);
  const src = normalize(path.join(real, options.src));
  const composition = normalize(path.join(src, options.composition));
  return {
    root: real,
    src,
    modules: normalize(path.join(src, options.modules)),
    composition,
    compositionDir: composition.replace(/\.[cm]?[jt]sx?$/, ''),
  };
}



/**
 * Checks whether a directory is an audited application root.
 *
 * Purpose: Recognize roots by compiler config and composition.
 *
 * @param {string} directory Candidate application directory.
 * @param {object} options Parsed command options.
 * @returns {boolean} Whether both markers exist.
 */
function isAppRoot(directory, options) {
  // Require compiler configuration and a composition root.
  return fs.existsSync(path.join(directory, 'tsconfig.json'))
    && fs.existsSync(path.join(directory, options.src, options.composition));
}



/**
 * Finds the nearest application root above one file.
 *
 * Purpose: Map changed files to their owning application.
 *
 * @param {string} file Absolute changed file path.
 * @param {string} stop Repository top-level directory.
 * @param {object} options Parsed command options.
 * @returns {string|undefined} Owning application root.
 */
function nearestRoot(file, stop, options) {
  // Walk upward without leaving the repository.
  let directory = path.dirname(file);
  while (directory === stop || directory.startsWith(`${stop}${path.sep}`)) {
    if (isAppRoot(directory, options)) return directory;
    if (directory === stop) break;
    directory = path.dirname(directory);
  }
  return undefined;
}



/**
 * Discovers application roots owning changed source files.
 *
 * Purpose: Audit only applications affected by the change.
 *
 * @param {object} changes Changed, new, and deleted paths.
 * @param {object} options Parsed command options.
 * @returns {Array<string>} Sorted unique application roots.
 */
export function findAppRoots(changes, options) {
  // Keep roots whose source folder contains a changed path.
  const roots = new Set();
  for (const file of [...changes.files.keys(), ...changes.deleted]) {
    const root = nearestRoot(file, changes.toplevel, options);
    const src = root && path.join(root, options.src);
    if (src && file.startsWith(`${src}${path.sep}`)) roots.add(root);
  }
  return [...roots].sort();
}
