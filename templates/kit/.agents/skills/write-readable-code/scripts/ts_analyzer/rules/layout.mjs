// Checks step comments and spacing between function declarations.
// Keeps outline and whitespace rules apart from documentation.

import { declaredUnit } from '../syntax/functions.mjs';

/** Inline callbacks need outlines from this many statements. */
const INLINE_STEP_THRESHOLD = 3;

/** Blank lines required between adjacent function units. */
const FUNCTION_GAP = 3;



/**
 * Detects a step comment touching one position.
 *
 * Purpose: Read leading and trailing trivia, ignoring JSDoc.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {string} text Complete source text.
 * @param {number} position Node boundary to probe.
 * @returns {boolean} Whether a non-JSDoc comment is there.
 */
function stepCommentAt(ts, text, position) {
  // Combine both trivia directions, then drop doc comments.
  const ranges = [
    ...(ts.getLeadingCommentRanges(text, position) ?? []),
    ...(ts.getTrailingCommentRanges(text, position) ?? []),
  ];
  return ranges.some((range) => !text.startsWith('/**', range.pos));
}



/**
 * Detects a non-JSDoc comment inside a function body.
 *
 * Purpose: Prove a body carries at least one step comment.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} sourceFile Parsed source file.
 * @param {object} body Function body block.
 * @returns {boolean} Whether the body has a step comment.
 */
function hasStepComment(ts, sourceFile, body) {
  // Probe just inside both braces first.
  const text = sourceFile.text;
  let found = stepCommentAt(ts, text, body.statements.pos)
    || stepCommentAt(ts, text, body.statements.end);



  /**
   * Probes one node, skipping nested function bodies.
   *
   * Purpose: Credit only comments owned by this body.
   *
   * @param {object} node Current syntax node.
   * @returns {void} No value.
   */
  function visit(node) {
    // Stop once found; nested functions answer for themselves.
    if (found) return;
    found = stepCommentAt(ts, text, node.pos) || stepCommentAt(ts, text, node.end);
    if (!found && !ts.isFunctionLike(node)) ts.forEachChild(node, visit);
  }



  // Search statements until one comment appears.
  body.statements.forEach(visit);
  return found;
}



/**
 * Requires outline comments inside function bodies.
 *
 * Purpose: Keep every multi-line function scannable by steps.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} sourceFile Parsed source file.
 * @param {object} units Collected units for this file.
 * @param {Function} report Finding reporter for this file.
 * @returns {void} No value.
 */
export function checkStepComments(ts, sourceFile, units, report) {
  // Require a step comment in every declared body.
  for (const unit of units.declared) {
    const body = unit.fn.body;
    if (!body || !ts.isBlock(body) || body.statements.length === 0) continue;
    if (hasStepComment(ts, sourceFile, body)) continue;
    const message = `${unit.label} body needs a one-line step comment.`;
    report({ rule: 'comment/step', from: body.getStart(sourceFile), to: body.end, message });
  }

  // Nudge longer inline callbacks toward outline comments.
  for (const fn of units.inline) {
    const count = fn.body.statements.length;
    if (count < INLINE_STEP_THRESHOLD || hasStepComment(ts, sourceFile, fn.body)) continue;
    const message = `Inline function with ${count} statements needs a step comment.`;
    report({ rule: 'comment/step', level: 'warning', from: fn.body.getStart(sourceFile), to: fn.body.end, message });
  }
}



/**
 * Finds where a declaration visually begins.
 *
 * Purpose: Measure spacing above comments, not below them.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} sourceFile Parsed source file.
 * @param {object} node Declaration node.
 * @returns {number} Position of its first leading comment or token.
 */
function visualStart(ts, sourceFile, node) {
  // Prefer the first comment on lines above the node.
  const ranges = ts.getLeadingCommentRanges(sourceFile.text, node.pos);
  return ranges?.length ? ranges[0].pos : node.getStart(sourceFile);
}



/**
 * Counts blank lines between two positions.
 *
 * Purpose: Measure separation between adjacent declarations.
 *
 * @param {string} text Complete source text.
 * @param {number} from Position after the earlier declaration.
 * @param {number} to Visual start of the later declaration.
 * @returns {number} Whitespace-only lines strictly between them.
 */
function blankLinesBetween(text, from, to) {
  // Ignore the partial first and last lines.
  const segments = text.slice(from, to).split('\n').slice(1, -1);
  return segments.filter((segment) => !segment.trim()).length;
}



/**
 * Labels nodes that need generous surrounding space.
 *
 * Purpose: Treat functions and classes as spacing subjects.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} node Statement or class member.
 * @returns {string|undefined} Readable label, when spaced.
 */
function spacedLabel(ts, node) {
  // Prefer function labels, then name class declarations.
  const unit = declaredUnit(ts, node);
  if (unit) return unit.label;
  return ts.isClassDeclaration(node) ? `Class ${node.name?.text ?? 'default'}` : undefined;
}



/**
 * Requires generous blank lines between adjacent functions.
 *
 * Purpose: Make every function boundary obvious while scanning.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} sourceFile Parsed source file.
 * @param {object} units Collected units for this file.
 * @param {Function} report Finding reporter for this file.
 * @returns {void} No value.
 */
export function checkSpacing(ts, sourceFile, units, report) {
  // Compare each adjacent pair within one list.
  for (const list of units.lists) {
    for (let index = 1; index < list.length; index += 1) {
      const label = spacedLabel(ts, list[index]);
      if (!label || !spacedLabel(ts, list[index - 1])) continue;

      // Report gaps narrower than the required separation.
      const start = visualStart(ts, sourceFile, list[index]);
      const found = blankLinesBetween(sourceFile.text, list[index - 1].end, start);
      if (found >= FUNCTION_GAP) continue;
      const message = `Leave ${FUNCTION_GAP} blank lines before ${label}; found ${found}.`;
      report({ rule: 'layout/function-spacing', from: start, message });
    }
  }
}
