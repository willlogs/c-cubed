// Resolves the typescript package for syntax-only analysis.
// Falls back to the main checkout when worktrees lack dependencies.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { createRequire } from 'node:module';



/**
 * Requires typescript as seen from one folder.
 *
 * Purpose: Reuse Node resolution, which walks parent folders.
 *
 * @param {string} folder Folder to resolve from.
 * @returns {object|undefined} TypeScript module, when resolvable.
 */
function requireFrom(folder) {
  // Treat resolution failures as a missing candidate.
  try {
    return createRequire(path.join(folder, 'noop.js'))('typescript');
  } catch {
    return undefined;
  }
}



/**
 * Runs one quiet command and returns trimmed output.
 *
 * Purpose: Probe git and npm without noisy failures.
 *
 * @param {string} command Executable name.
 * @param {string[]} args Command arguments.
 * @param {string} cwd Folder where the command runs.
 * @returns {string|undefined} Trimmed output, when it succeeds.
 */
function quietOutput(command, args, cwd) {
  // Swallow failures; callers try the next candidate.
  try {
    return execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return undefined;
  }
}



/**
 * Finds the main checkout behind a git worktree.
 *
 * Purpose: Borrow dependencies from the checkout that installed them.
 *
 * @param {string} folder Folder inside the worktree.
 * @returns {string|undefined} Main checkout folder, when known.
 */
function mainCheckout(folder) {
  // Resolve the shared git directory to its owning checkout.
  const common = quietOutput('git', ['rev-parse', '--git-common-dir'], folder);
  if (!common) return undefined;
  const absolute = path.resolve(folder, common);
  return path.basename(absolute) === '.git' ? path.dirname(absolute) : undefined;
}



/**
 * Loads typescript from the best available location.
 *
 * Purpose: Keep checks working in dependency-free worktrees.
 *
 * @param {string|undefined} explicit Folder named by --typescript.
 * @param {string[]} starts Folders near the analyzed files.
 * @returns {object} Loaded module and note, or an error.
 */
export function loadTypeScript(explicit, starts) {
  // Honor an explicit location before searching.
  if (explicit) {
    const ts = requireFrom(path.resolve(explicit));
    return ts ? { ts } : { error: `No typescript package resolves from ${explicit}.` };
  }

  // Search near the files, then each main checkout.
  for (const start of starts) {
    const ts = requireFrom(start);
    if (ts) return { ts };
  }
  for (const checkout of starts.map(mainCheckout).filter(Boolean)) {
    const ts = requireFrom(checkout);
    if (ts) return { ts, note: `Using typescript from main checkout ${checkout}.` };
  }

  // Try a global install before giving up.
  const globalRoot = quietOutput('npm', ['root', '-g'], starts[0]);
  const ts = globalRoot ? requireFrom(path.dirname(globalRoot)) : undefined;
  if (ts) return { ts, note: 'Using globally installed typescript.' };
  return { error: 'TypeScript checks skipped: install typescript or pass --typescript DIR.' };
}
