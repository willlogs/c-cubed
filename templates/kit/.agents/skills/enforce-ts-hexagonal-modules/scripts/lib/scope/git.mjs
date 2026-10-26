// Collects working-tree changes from git for change scoping.
// Keeps process handling separate from diff parsing.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { parseDiff } from './diff.mjs';



/**
 * Runs one git command and returns stdout.
 *
 * Purpose: Centralize buffering and error capture.
 *
 * @param {Array<string>} args Git arguments.
 * @param {string} cwd Directory to run git in.
 * @returns {string} Command standard output.
 */
function git(args, cwd) {
  // Surface stderr through the thrown error.
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 512 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}



/**
 * Resolves the commit that changes are compared against.
 *
 * Purpose: Support HEAD and merge-base comparisons.
 *
 * @param {object} options Parsed command options.
 * @param {string} toplevel Repository top-level directory.
 * @returns {string} Base commit hash.
 */
function resolveBase(options, toplevel) {
  // Use the merge base when a reference was given.
  const args = options.since
    ? ['merge-base', options.since, 'HEAD']
    : ['rev-parse', '--verify', 'HEAD'];
  return git(args, toplevel).trim();
}



/**
 * Adds untracked files as wholly new files.
 *
 * Purpose: Include files git diff cannot see.
 *
 * @param {object} changes Mutable changed-file collection.
 * @param {string} toplevel Repository top-level directory.
 * @returns {void} No value.
 */
function addUntracked(changes, toplevel) {
  // List untracked files that are not ignored.
  const output = git(['ls-files', '--others', '--exclude-standard', '-z'], toplevel);
  for (const relative of output.split('\0').filter(Boolean)) {
    changes.files.set(path.join(toplevel, relative), { status: 'new' });
  }
}



/**
 * Collects changed files and lines for scoping.
 *
 * Purpose: Implement --changed and --since comparisons.
 *
 * @param {object} options Parsed command options.
 * @returns {object} Toplevel, base, files, deleted, or error.
 */
export function collectChanges(options) {
  // Locate the repository from the root or working directory.
  try {
    const start = options.root ? path.resolve(options.root) : process.cwd();
    const toplevel = fs.realpathSync(git(['rev-parse', '--show-toplevel'], start).trim());
    const base = resolveBase(options, toplevel);

    // Combine tracked edits with untracked files.
    const diff = git([
      '-c', 'core.quotePath=false', 'diff', '--unified=0', '--no-color',
      '--no-ext-diff', '--find-renames', base,
    ], toplevel);
    const changes = { toplevel, base, ...parseDiff(diff, toplevel) };
    addUntracked(changes, toplevel);
    return changes;
  } catch (error) {
    const detail = error.stderr?.toString().trim() || error.message;
    return { error: `Cannot collect git changes: ${detail}` };
  }
}
