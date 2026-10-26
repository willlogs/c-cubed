// Prints architecture findings for editors and CI.
// Keeps presentation separate from audit behavior.

import path from 'node:path';
import process from 'node:process';



/**
 * Orders findings by file and position.
 *
 * Purpose: Keep diagnostics deterministic across runs.
 *
 * @param {object} left First finding to compare.
 * @param {object} right Second finding to compare.
 * @returns {number} Negative, zero, or positive ordering value.
 */
function compareFindings(left, right) {
  // Sort by path, then line, then column.
  return left.file.localeCompare(right.file)
    || left.line - right.line
    || left.column - right.column;
}



/**
 * Formats one finding as an editor-friendly line.
 *
 * Purpose: Produce stable, clickable diagnostics.
 *
 * @param {object} finding Positioned architecture finding.
 * @returns {string} Printable diagnostic line.
 */
export function formatFinding(finding) {
  // Mark partially edited legacy code explicitly.
  const relative = path.relative(process.cwd(), finding.file) || finding.file;
  const suffix = finding.scope === 'touched' ? ' (touched legacy code)' : '';
  return `${relative}:${finding.line}:${finding.column}: error: `
    + `[${finding.rule}] ${finding.message}${suffix}`;
}



/**
 * Builds the summary line for one audited root.
 *
 * Purpose: Report totals, including hidden pre-existing findings.
 *
 * @param {object} result Audit result for one root.
 * @param {object} scoped Shown findings and hidden count.
 * @returns {string} Printable summary line.
 */
function summarize(result, scoped) {
  // Describe full audits without change-scope wording.
  const name = path.relative(process.cwd(), result.root) || '.';
  const count = scoped.shown.length;
  if (scoped.hidden === undefined) {
    return count
      ? `Architecture failed for ${name} with ${count} violation(s) across ${result.sourceCount} source file(s).`
      : `Architecture passed for ${name} across ${result.sourceCount} source file(s).`;
  }

  // Split scoped findings into new and touched code.
  const touched = scoped.shown.filter((finding) => finding.scope === 'touched').length;
  const hidden = `${scoped.hidden} pre-existing finding(s) hidden`;
  return count
    ? `Architecture failed for ${name} with ${count} violation(s) in changed code (${count - touched} new, ${touched} touched); ${hidden}.`
    : `Architecture passed for ${name} in changed code; ${hidden}.`;
}



/**
 * Prints one root's findings and summary.
 *
 * Purpose: Emit diagnostics before their totals.
 *
 * @param {object} result Audit result for one root.
 * @param {object} scoped Shown findings and hidden count.
 * @returns {void} No value.
 */
export function printRootResult(result, scoped) {
  // Print sorted findings, then one summary line.
  for (const finding of [...scoped.shown].sort(compareFindings)) {
    console.log(formatFinding(finding));
  }
  console.log(summarize(result, scoped));
}
