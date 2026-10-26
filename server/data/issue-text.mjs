// Reads links and reasons out of GitHub issue markdown.
// Shared by the Map graph and Today's daily plan reader.

/** Quoted lines start with ">", as GitHub writes them. */
const QUOTE = /^\s*>\s?/;

/** Any markdown heading line. */
const HEADING = /^#{1,6}\s/;



/**
 * Lists the unique first-group matches of a pattern.
 *
 * Purpose: Pull issue numbers and decision ids from prose.
 *
 * @param text Text to search.
 * @param pattern Global regular expression with one group.
 * @returns Unique matched strings in order.
 */
export function captures(text, pattern) {
  // Duplicates add nothing to a link list.
  return [...new Set([...String(text ?? "").matchAll(pattern)].map((match) => match[1]))];
}



/**
 * Reads the first quote under an issue's "Decided by" heading.
 *
 * Purpose: Show the owner's own words as an issue's reason.
 *
 * @param body Issue body in markdown.
 * @returns The quoted words on one line, or "" without any.
 */
export function decidedQuote(body) {
  // The section runs from its heading to the next one.
  const lines = String(body ?? "").split(/\r?\n/);
  const start = lines.findIndex((line) => /^#{1,6}\s*Decided by\b/i.test(line));
  const quoted = [];
  for (const line of start < 0 ? [] : lines.slice(start + 1)) {
    // Stop at a heading, or where the first quote ends.
    if (HEADING.test(line) || (quoted.length && !QUOTE.test(line))) break;
    if (QUOTE.test(line)) quoted.push(line.replace(QUOTE, "").trim());
  }
  return quoted.filter(Boolean).join(" ");
}
