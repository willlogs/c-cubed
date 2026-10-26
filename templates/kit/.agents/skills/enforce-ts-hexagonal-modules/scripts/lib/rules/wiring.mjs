// Detects hidden dependency configuration in source text.
// Keeps service-locator conventions in one reviewable list.



/** Patterns revealing mutable port wiring or service location. */
const FORBIDDEN_CONFIGURATION = [
  /configure[A-Z]\w*Ports?/g,
  /set[A-Z]\w*Ports?/g,
  /serviceLocator/gi,
  /container\.resolve/g,
];



/**
 * Finds every hidden dependency configuration match.
 *
 * Purpose: Reject service locators and mutable port wiring.
 *
 * @param {string} text Complete source text.
 * @returns {Array<object>} Match offsets and matched text.
 */
export function configurationViolations(text) {
  // Report every match so new ones survive scoping.
  return FORBIDDEN_CONFIGURATION.flatMap((pattern) => (
    [...text.matchAll(pattern)].map((match) => ({ index: match.index, text: match[0] }))
  ));
}
