// Resolves the TypeScript compiler for an audited application.
// Falls back to the main checkout for dependency-free worktrees.

import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';



/**
 * Requires TypeScript starting from one directory.
 *
 * Purpose: Reuse Node resolution, including ancestor node_modules.
 *
 * @param {string} directory Directory where resolution starts.
 * @returns {object|undefined} TypeScript module when resolvable.
 */
function requireFrom(directory) {
  // Resolve as if a file inside the directory imported it.
  try {
    return createRequire(path.join(directory, 'noop.js'))('typescript');
  } catch {
    return undefined;
  }
}



/**
 * Finds the main checkout sharing this repository.
 *
 * Purpose: Reach installed dependencies from linked worktrees.
 *
 * @param {string} root Absolute application root.
 * @returns {string|undefined} Main checkout directory when known.
 */
function mainCheckout(root) {
  // The common git directory sits inside the main checkout.
  try {
    const common = execFileSync('git', ['rev-parse', '--git-common-dir'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return path.dirname(path.resolve(root, common));
  } catch {
    return undefined;
  }
}



/**
 * Loads TypeScript via explicit, local, then shared resolution.
 *
 * Purpose: Run audits in worktrees without node_modules.
 *
 * @param {string} root Absolute application root.
 * @param {string|undefined} explicit Directory passed with --typescript.
 * @returns {object} Compiler module, optional note, or error.
 */
export function loadTypeScript(root, explicit) {
  // Honor an explicit compiler location first.
  if (explicit) {
    const ts = requireFrom(path.resolve(explicit));
    return ts ? { ts } : { error: `Cannot resolve typescript from --typescript ${explicit}.` };
  }

  // Prefer the application's own dependency tree.
  const local = requireFrom(root);
  if (local) return { ts: local };

  // Fall back to the main checkout for linked worktrees.
  const checkout = mainCheckout(root);
  const shared = checkout ? requireFrom(checkout) : undefined;
  if (shared) {
    return { ts: shared, note: `Note: using typescript ${shared.version} from ${checkout} (main checkout fallback).` };
  }
  return { error: `Cannot resolve typescript from ${root}; install it or pass --typescript <dir>.` };
}
