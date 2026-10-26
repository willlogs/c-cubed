// Mirrors each session into a headless terminal.
// Gives the master readable text and browsers an exact redraw.

import serialize from "@xterm/addon-serialize";
import headless from "@xterm/headless";

const { Terminal } = headless;
const { SerializeAddon } = serialize;

/** DEC modes the serializer skips: cursor, mouse encodings, sync. */
const EXTRA_MODES = [25, 1006, 1016, 2026];

/** Each mirror's serializer and the extra modes it saw. */
const mirrors = new WeakMap();



/**
 * Creates a headless terminal that mirrors a session.
 *
 * Purpose: Track exactly what the session's screen shows.
 *
 * @param cols Columns of the session terminal.
 * @param rows Rows of the session terminal.
 * @returns Headless terminal with scrollback.
 */
export function createScreen(cols, rows) {
  // Keep enough scrollback for a worker's recent progress.
  const screen = new Terminal({ cols, rows, scrollback: 2000, allowProposedApi: true });
  const serializer = new SerializeAddon();
  screen.loadAddon(serializer);
  mirrors.set(screen, { serializer, modes: watchModes(screen) });
  return screen;
}



/**
 * Records the modes the serializer leaves out.
 *
 * Purpose: Keep mouse and cursor modes across redraws.
 *
 * @param screen Headless terminal mirror.
 * @returns Live map of mode number to on or off.
 */
function watchModes(screen) {
  // Returning false lets xterm apply each mode as usual.
  const modes = new Map();
  for (const final of ["h", "l"]) {
    screen.parser.registerCsiHandler({ prefix: "?", final }, (params) => {
      // One sequence may set several modes.
      for (const mode of params) if (EXTRA_MODES.includes(mode)) modes.set(mode, final === "h");
      return false;
    });
  }

  // A full reset (ESC c) restores every default.
  screen.parser.registerEscHandler({ final: "c" }, () => {
    modes.clear();
    return false;
  });
  return modes;
}



/**
 * Rebuilds a mirrored screen as terminal output.
 *
 * Purpose: Redraw a browser terminal exactly like the session.
 *
 * @param screen Headless terminal mirror.
 * @returns Promise of output that resets, then redraws, a terminal.
 */
export function screenSnapshot(screen) {
  // The empty write calls back once earlier output is parsed.
  const { serializer, modes } = mirrors.get(screen);
  return new Promise((resolve, reject) => {
    screen.write("", () => {
      // Never throw inside xterm's write loop.
      try {
        const extra = [...modes].map(([mode, on]) => `\x1b[?${mode}${on ? "h" : "l"}`).join("");
        resolve(`\x1bc${serializer.serialize()}${extra}`);
      } catch (error) {
        reject(error);
      }
    });
  });
}



/**
 * Reads the last rendered lines of a mirrored screen.
 *
 * Purpose: Let the master read a worker cheaply and accurately.
 *
 * @param screen Headless terminal mirror.
 * @param count Number of trailing lines.
 * @returns Plain text lines joined by newlines.
 */
export function screenLines(screen, count) {
  // Translate each buffer line, then drop trailing blank rows.
  const buffer = screen.buffer.active;
  const lines = [];
  for (let index = 0; index < buffer.length; index += 1) lines.push(buffer.getLine(index)?.translateToString(true) ?? "");
  while (lines.length && !lines.at(-1).trim()) lines.pop();
  return lines.slice(-count).join("\n");
}
