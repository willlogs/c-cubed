// Builds positioned architecture findings for later scoping.
// Keeps coordinate math separate from rule evaluation.

import fs from 'node:fs';



/**
 * Adds one node-positioned architecture finding.
 *
 * Purpose: Record anchor coordinates and the touched span.
 *
 * @param {Array<object>} findings Mutable finding collection.
 * @param {object} source Parsed source owning the node.
 * @param {object} details Node, optional span, rule, message, module.
 * @returns {void} No value.
 */
export function report(findings, source, details) {
  // Convert offsets into one-based editor coordinates.
  const anchor = source.getLineAndCharacterOfPosition(details.node.getStart(source));
  const span = details.span ?? details.node;
  const first = source.getLineAndCharacterOfPosition(span.getStart(source));
  const last = source.getLineAndCharacterOfPosition(span.getEnd());
  findings.push({
    file: source.fileName,
    line: anchor.line + 1,
    column: anchor.character + 1,
    spanStart: first.line + 1,
    spanEnd: last.line + 1,
    rule: details.rule,
    message: details.message,
    module: details.module,
  });
}



/**
 * Counts physical lines in one file.
 *
 * Purpose: Let whole-file findings span every line.
 *
 * @param {string} file Absolute file path.
 * @returns {number} Line count, at least one.
 */
function countLines(file) {
  // Treat missing or unreadable files as one line.
  try {
    return Math.max(1, fs.readFileSync(file, 'utf8').split('\n').length);
  } catch {
    return 1;
  }
}



/**
 * Adds one finding spanning a whole file.
 *
 * Purpose: Scope file-level findings by any edit.
 *
 * @param {Array<object>} findings Mutable finding collection.
 * @param {string} file Absolute file path owning the finding.
 * @param {object} details Rule, message, and optional module.
 * @returns {void} No value.
 */
export function fileFinding(findings, file, details) {
  // Anchor at the first line and cover the file.
  findings.push({
    file,
    line: 1,
    column: 1,
    spanStart: 1,
    spanEnd: countLines(file),
    rule: details.rule,
    message: details.message,
    module: details.module,
  });
}
