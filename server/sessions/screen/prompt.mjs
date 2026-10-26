// Reads the draft in Claude's input box on a mirror.
// The queue holds messages while a draft sits there.

/** First-row marks: a normal prompt, or shell mode. */
const MARKS = { "❯": "prompt", ">": "prompt", "!": "shell" };



/**
 * Tells whether a row is a box border line.
 *
 * Purpose: Find the box between its two horizontal rules.
 *
 * @param text Row text.
 * @param cols Screen width in columns.
 * @returns True for a long run of box-drawing dashes.
 */
function isRule(text, cols) {
  // Claude draws the rules across the whole width.
  const line = text.trim();
  return line.length >= cols / 2 && /^─+$/.test(line);
}



/**
 * Reads a row without its faded cells.
 *
 * Purpose: Ignore hint and suggestion text Claude draws dim.
 *
 * @param line Buffer line.
 * @param cols Screen width in columns.
 * @returns Row text with dim cells blanked.
 */
function typedRow(line, cols) {
  // Wide characters leave an empty second cell; skip it.
  let text = "";
  for (let x = 0; x < cols; x += 1) {
    const cell = line.getCell(x);
    if (!cell || cell.getWidth() === 0) continue;
    text += cell.isDim() ? " " : cell.getChars() || " ";
  }
  return text.trimEnd();
}



/**
 * Returns the draft in Claude's input box.
 *
 * Purpose: Never paste a queued message into someone's draft.
 *
 * @param screen Headless terminal mirror of a session.
 * @returns Typed text, "!" for shell mode, or "" when none.
 */
export function draftText(screen) {
  // Read only rows on screen; the box sits low.
  const buffer = screen.buffer.active;
  const rows = Array.from({ length: screen.rows }, (_, y) => buffer.getLine(buffer.baseY + y));
  const texts = rows.map((line) => line?.translateToString(true) ?? "");

  // The box opens with a rule, then a marked row.
  const top = texts.findLastIndex((text, y) => y > 0 && MARKS[text[0]] && isRule(texts[y - 1], screen.cols));
  const bottom = texts.findIndex((text, y) => y > top && isRule(text, screen.cols));
  if (top < 0 || bottom < 0) return "";

  // Rows indent two columns, past the mark on the first.
  const draft = rows.slice(top, bottom).map((line) => typedRow(line, screen.cols).slice(2)).join("\n").trim();

  // Empty shell mode counts; a paste would run commands.
  return MARKS[texts[top][0]] === "shell" ? `!${draft}` : draft;
}
