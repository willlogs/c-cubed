// Checks JSDoc hover cards on documentable declarations.
// Keeps documentation rules separate from layout rules.

/** Unit kinds that never return a value. */
const NO_OUTPUT_KINDS = new Set(['constructor', 'setter']);

/** Labeled sections that cannot double as the summary. */
const SECTION_LABEL = /^(?:Purpose|Inputs|Output|Returns|Side effects?):/i;



/**
 * Strips JSDoc delimiters into plain content lines.
 *
 * Purpose: Let rules read sections without comment syntax.
 *
 * @param {object} sourceFile Parsed source file.
 * @param {object} doc JSDoc node attached to a declaration.
 * @returns {string[]} Trimmed content lines, blanks preserved.
 */
function docLines(sourceFile, doc) {
  // Remove openers, closers, and leading asterisks per line.
  return sourceFile.text.slice(doc.pos, doc.end).split('\n').map((line) => line
    .replace(/^\s*\/\*\*/, '')
    .replace(/\*\/\s*$/, '')
    .replace(/^\s*\*(?!\/)/, '')
    .trim());
}



/**
 * Lists parameter names documented by @param tags.
 *
 * Purpose: Match documented inputs against declared parameters.
 *
 * @param {string[]} lines JSDoc content lines.
 * @returns {string[]} Documented root parameter names.
 */
function paramTagNames(lines) {
  // Read names after optional type braces and brackets.
  const pattern = /^@param\s+(?:\{[^}]*\}\s*)?\[?\s*([A-Za-z_$][\w$]*)/;
  return lines.map((line) => pattern.exec(line)?.[1]).filter(Boolean);
}



/**
 * Lists input documentation a function lacks.
 *
 * Purpose: Require every parameter, or explicit absence.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} fn Function node being documented.
 * @param {string[]} lines JSDoc content lines.
 * @returns {string[]} Missing input section names.
 */
function missingInputs(ts, fn, lines) {
  // Ignore TypeScript's synthetic this parameter.
  const parameters = fn.parameters.filter((item) => item.name.getText() !== 'this');
  if (parameters.length === 0) {
    return lines.some((line) => /^Inputs:\s*None\b/i.test(line)) ? [] : ['"Inputs: None." line'];
  }

  // Match named parameters, then count tags for patterns.
  const tags = paramTagNames(lines);
  const named = parameters.filter((item) => ts.isIdentifier(item.name)).map((item) => item.name.text);
  const missing = named.filter((name) => !tags.includes(name)).map((name) => `@param ${name}`);
  const spare = tags.filter((name) => !named.includes(name)).length;
  const patterns = parameters.length - named.length;
  return spare < patterns ? [...missing, '@param for each destructured input'] : missing;
}



/**
 * Lists every hover-card section a function lacks.
 *
 * Purpose: Report all gaps in one actionable finding.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} unit Declared function unit.
 * @param {string[]} lines JSDoc content lines.
 * @returns {string[]} Missing section names.
 */
function missingSections(ts, unit, lines) {
  // Require summary, purpose, inputs, and output.
  const text = lines.join('\n');
  const missing = [];
  if (!lines.some((line) => line && !line.startsWith('@') && !SECTION_LABEL.test(line))) {
    missing.push('summary line');
  }
  if (!/^Purpose:\s*\S/m.test(text)) missing.push('"Purpose:" line');
  missing.push(...missingInputs(ts, unit.fn, lines));
  if (!NO_OUTPUT_KINDS.has(unit.kind) && !/^(?:@returns?\b|Output:|Returns:)/m.test(text)) {
    missing.push('@returns');
  }
  return missing;
}



/**
 * Recognizes a plain prose line inside JSDoc.
 *
 * Purpose: Separate prose from tags, bullets, and fences.
 *
 * @param {string} line JSDoc content line.
 * @returns {boolean} Whether the line is plain prose.
 */
function isPlain(line) {
  // Exclude blanks, tags, list markers, and code fences.
  return Boolean(line) && !/^(?:@|[-*+>|]|\d+[.)]\s|```)/.test(line);
}



/**
 * Finds separate statements a hover card would merge.
 *
 * Purpose: Keep summary, purpose, and sections visually distinct.
 *
 * @param {string[]} lines JSDoc content lines.
 * @returns {number} Index of the first merged line, or -1.
 */
function mergedLineIndex(lines) {
  // Flag a finished sentence followed directly by more prose.
  let fenced = false;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index - 1].startsWith('```')) fenced = !fenced;
    const merged = isPlain(lines[index - 1]) && isPlain(lines[index]);
    if (!fenced && merged && /[.!?]$/.test(lines[index - 1])) return index;
  }
  return -1;
}



/**
 * Checks one declared function's hover card.
 *
 * Purpose: Require complete, readable documentation on functions.
 *
 * @param {object} ts TypeScript compiler module.
 * @param {object} sourceFile Parsed source file.
 * @param {object} unit Declared function unit.
 * @param {Function} report Finding reporter for this file.
 * @returns {void} No value.
 */
export function checkUnitDocs(ts, sourceFile, unit, report) {
  // Require a hover card on every declared function.
  const doc = unit.owner.jsDoc?.at(-1);
  const end = unit.fn.end;
  if (!doc) {
    const message = `${unit.label} needs JSDoc: summary, Purpose, inputs, @returns.`;
    report({ rule: 'doc/missing', from: unit.owner.getStart(sourceFile), to: end, message });
    return;
  }

  // Report missing sections together, at the comment.
  const lines = docLines(sourceFile, doc);
  const missing = missingSections(ts, unit, lines);
  if (missing.length) {
    report({ rule: 'doc/sections', from: doc.pos, to: end, message: `${unit.label} JSDoc lacks ${missing.join(', ')}.` });
  }

  // Warn when separate statements would merge on hover.
  const merged = mergedLineIndex(lines);
  if (merged > 0) {
    const line = sourceFile.getLineAndCharacterOfPosition(doc.pos).line + merged;
    const message = 'Separate JSDoc statements with a blank line; hover merges them.';
    report({ rule: 'doc/merged-lines', level: 'warning', from: sourceFile.getPositionOfLineAndCharacter(line, 0), message });
  }
}



/**
 * Checks that a class or exported type has a summary.
 *
 * Purpose: Document shared data shapes and behavior owners.
 *
 * @param {object} sourceFile Parsed source file.
 * @param {object} unit Class or type unit.
 * @param {Function} report Finding reporter for this file.
 * @returns {void} No value.
 */
export function checkTypeDocs(sourceFile, unit, report) {
  // Accept any JSDoc summary on shared shapes.
  if (unit.owner.jsDoc?.length) return;
  const message = `${unit.label} needs a JSDoc summary line.`;
  report({ rule: 'doc/missing', from: unit.owner.getStart(sourceFile), to: unit.owner.end, message });
}
