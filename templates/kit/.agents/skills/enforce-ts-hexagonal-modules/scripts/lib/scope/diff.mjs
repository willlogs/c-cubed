// Parses zero-context git diffs into changed files and lines.
// Keeps diff syntax separate from git process handling.

import path from 'node:path';



/**
 * Splits diff output into per-file sections.
 *
 * Purpose: Parse each file's header and hunks independently.
 *
 * @param {string} text Complete unified diff output.
 * @returns {Array<Array<string>>} Lines grouped by file section.
 */
function splitSections(text) {
  // Start a new section at every file header.
  const sections = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('diff --git ')) sections.push([line]);
    else sections.at(-1)?.push(line);
  }
  return sections;
}



/**
 * Reads file facts from one section header.
 *
 * Purpose: Detect new, deleted, renamed, and modified files.
 *
 * @param {Array<string>} lines Lines of one file section.
 * @returns {object} Old path, new path, and status flags.
 */
function readHeader(lines) {
  // Stop at the first hunk; content may mimic headers.
  const header = { isNew: false, isDeleted: false };
  for (const line of lines) {
    if (line.startsWith('@@')) break;
    if (line.startsWith('new file mode')) header.isNew = true;
    else if (line.startsWith('deleted file mode') || line === '+++ /dev/null') header.isDeleted = true;
    else if (line.startsWith('--- a/')) header.oldPath = line.slice(6);
    else if (line.startsWith('+++ b/')) header.newPath = line.slice(6);
    else if (line.startsWith('rename from ')) header.oldPath = line.slice(12);
    else if (line.startsWith('rename to ')) header.newPath = line.slice(10);
  }

  // Fall back to the section header for mode-only changes.
  const fallback = /^diff --git a\/(.+) b\/(.+)$/.exec(lines[0]);
  header.oldPath ??= fallback?.[1];
  if (!header.isDeleted) header.newPath ??= fallback?.[2];
  return header;
}



/**
 * Collects new-file line numbers from hunk headers.
 *
 * Purpose: Mark exactly which lines the change added.
 *
 * @param {Array<string>} lines Lines of one file section.
 * @returns {Set<number>} One-based added or replaced lines.
 */
function addedLines(lines) {
  // Expand each "+start,count" range into line numbers.
  const added = new Set();
  for (const line of lines) {
    const match = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/.exec(line);
    if (!match) continue;
    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let offset = 0; offset < count; offset += 1) added.add(start + offset);
  }
  return added;
}



/**
 * Parses diff output into file changes.
 *
 * Purpose: Feed change scoping with new and edited lines.
 *
 * @param {string} text Output of git diff --unified=0.
 * @param {string} toplevel Repository top-level directory.
 * @returns {object} Changed files map and deleted path set.
 */
export function parseDiff(text, toplevel) {
  // Record one change per file section.
  const files = new Map();
  const deleted = new Set();
  for (const lines of splitSections(text)) {
    const header = readHeader(lines);
    if (header.oldPath && header.oldPath !== header.newPath) {
      deleted.add(path.join(toplevel, header.oldPath));
    }
    if (header.isDeleted || !header.newPath) continue;

    // New files are wholly new; others keep added lines.
    const file = path.join(toplevel, header.newPath);
    files.set(file, header.isNew
      ? { status: 'new' }
      : { status: 'modified', added: addedLines(lines) });
  }
  return { files, deleted };
}
