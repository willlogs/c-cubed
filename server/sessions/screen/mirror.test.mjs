// Checks that a snapshot redraws a mirror exactly, modes included.
// Run: node --test server/sessions/screen/mirror.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { createScreen, screenLines, screenSnapshot } from "./mirror.mjs";

/** Claude's start modes: full screen, SGR mouse, paste, focus. */
const CLAUDE_MODES = "\x1b[?1049h\x1b[?1000h\x1b[?1002h\x1b[?1003h\x1b[?1006h\x1b[?2004h\x1b[?1004h";



/**
 * Writes output to a terminal and waits for parsing.
 *
 * Purpose: Read only after xterm's asynchronous write.
 *
 * @param terminal Headless terminal.
 * @param data Output to write.
 * @returns Promise resolving when the data is applied.
 */
function written(terminal, data) {
  // xterm calls back once this chunk is parsed.
  return new Promise((resolve) => terminal.write(data, resolve));
}



/**
 * Lists every cell's text and colors.
 *
 * Purpose: Compare two screens cell by cell.
 *
 * @param terminal Headless terminal.
 * @returns One string per cell of the active buffer.
 */
function cells(terminal) {
  // Characters plus colors and weight catch any drift.
  const buffer = terminal.buffer.active;
  const out = [];
  for (let y = 0; y < buffer.length; y += 1) {
    for (let x = 0; x < terminal.cols; x += 1) {
      const cell = buffer.getLine(y).getCell(x);
      out.push(`${cell.getChars()}|${cell.getFgColor()}|${cell.getBgColor()}|${cell.isBold()}`);
    }
  }
  return out;
}



test("a snapshot redraws a full-screen session exactly", async () => {
  // Draw like Claude: alternate screen, colors, a prompt line.
  const mirror = createScreen(40, 8);
  await written(mirror, `history\r\n${CLAUDE_MODES}\x1b[H\x1b[1;31mClaude\x1b[0m\x1b[7;1H> draft\x1b[?25l`);
  const copy = createScreen(40, 8);
  await written(copy, "stale text that the reset must clear");
  await written(copy, await screenSnapshot(mirror));

  // Same cells, cursor, buffer, and modes.
  assert.deepEqual(cells(copy), cells(mirror));
  assert.equal(copy.buffer.active.type, "alternate");
  assert.equal(copy.buffer.active.cursorX, mirror.buffer.active.cursorX);
  assert.equal(copy.buffer.active.cursorY, mirror.buffer.active.cursorY);
  assert.equal(copy.modes.mouseTrackingMode, "any");
  assert.equal(copy.modes.bracketedPasteMode, true);
  assert.equal(copy.modes.sendFocusMode, true);
});



test("a snapshot keeps the modes the serializer skips", async () => {
  // SGR mouse and a hidden cursor must survive a redraw.
  const mirror = createScreen(40, 8);
  await written(mirror, `${CLAUDE_MODES}\x1b[?25l`);
  const snapshot = await screenSnapshot(mirror);
  assert.ok(snapshot.startsWith("\x1bc"));
  assert.ok(snapshot.includes("\x1b[?1006h"));
  assert.ok(snapshot.includes("\x1b[?25l"));

  // A full reset clears what was tracked.
  await written(mirror, "\x1bc");
  assert.ok(!(await screenSnapshot(mirror)).includes("\x1b[?1006h"));
});



test("a snapshot after a resize matches the new size", async () => {
  // Resize, redraw, and compare at the new width.
  const mirror = createScreen(40, 8);
  await written(mirror, `${CLAUDE_MODES}\x1b[Hwide line`);
  mirror.resize(20, 6);
  await written(mirror, "\x1b[2J\x1b[Hnarrow");
  const copy = createScreen(20, 6);
  await written(copy, await screenSnapshot(mirror));
  assert.deepEqual(cells(copy), cells(mirror));
  assert.equal(screenLines(copy, 6), "narrow");
});
