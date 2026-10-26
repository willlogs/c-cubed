// Renders kit Markdown templates with project values.
// Supports {{name}}, {{#if name}}, and {{#unless name}} only.

/** A block tag alone on its own line. */
const STANDALONE_TAG = /^[ \t]*(\{\{[#/](?:if|unless)\b[^}]*\}\})[ \t]*\r?\n/gm;

/** Conditional blocks; different kinds may nest, one level each. */
const BLOCKS = {
  if: /\{\{#if\s+([A-Za-z]\w*)\s*\}\}([\s\S]*?)\{\{\/if\}\}/g,
  unless: /\{\{#unless\s+([A-Za-z]\w*)\s*\}\}([\s\S]*?)\{\{\/unless\}\}/g,
};

/** A plain value placeholder. */
const VALUE = /\{\{\s*([A-Za-z]\w*)\s*\}\}/g;



/**
 * Renders one template's text.
 *
 * Purpose: Turn a kit template into project-specific text.
 *
 * @param text Template text.
 * @param values Names to values; unknown names render empty.
 * @returns Rendered text.
 */
export function renderText(text, values) {
  // Standalone block tags must not leave blank lines.
  const compact = String(text).replace(STANDALONE_TAG, "$1");

  // Resolve blocks first, then substitute the remaining values.
  const withIf = compact.replace(BLOCKS.if, (_, name, body) => (isTrue(values[name]) ? body : ""));
  const withUnless = withIf.replace(BLOCKS.unless, (_, name, body) => (isTrue(values[name]) ? "" : body));
  const withIfAgain = withUnless.replace(BLOCKS.if, (_, name, body) => (isTrue(values[name]) ? body : ""));
  return withIfAgain.replace(VALUE, (_, name) => String(values[name] ?? ""));
}



/**
 * Tells whether a template value counts as true.
 *
 * Purpose: Treat empty strings, zero, and missing names as false.
 *
 * @param value Any template value.
 * @returns True when a block should render.
 */
export function isTrue(value) {
  // Empty arrays count as false too.
  if (Array.isArray(value)) return value.length > 0;
  return Boolean(value);
}



/**
 * Tells whether a file is rendered or copied as is.
 *
 * Purpose: Leave scripts and data byte for byte intact.
 *
 * @param file File name or path.
 * @returns True for Markdown files.
 */
export function isTemplate(file) {
  // Only Markdown carries placeholders.
  return file.toLowerCase().endsWith(".md");
}
