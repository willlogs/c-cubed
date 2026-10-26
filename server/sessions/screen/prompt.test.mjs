// Checks reading drafts out of Claude's input box.
// Run: node --test server/sessions/screen/prompt.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { createScreen } from "./mirror.mjs";
import { draftText } from "./prompt.mjs";

/** One of the box's border lines at 40 columns. */
const RULE = "─".repeat(40);



/**
 * Draws Claude's input box on a fresh mirror.
 *
 * Purpose: Test drafts against the layout Claude 2.1 draws.
 *
 * @param rows Box rows, the first starting with its mark.
 * @param above Optional text drawn above the box.
 * @returns Promise of a parsed 40x10 mirror.
 */
function boxScreen(rows, above = "Claude Code") {
  // Header, rules around the rows, then a status line.
  const screen = createScreen(40, 10);
  const lines = [above, "", RULE, ...rows, RULE, "  ⏵⏵ auto mode on"];
  return new Promise((resolve) => screen.write(lines.join("\r\n"), () => resolve(screen)));
}



test("an empty box has no draft", async () => {
  // Only the mark and its space.
  assert.equal(draftText(await boxScreen(["❯ "])), "");
});



test("typed text, on one row or several, is a draft", async () => {
  // Continuation rows indent by two columns.
  assert.equal(draftText(await boxScreen(["❯ hello there"])), "hello there");
  assert.equal(draftText(await boxScreen(["❯ line one", "  line two"])), "line one\nline two");
});



test("dim hint text is not a draft", async () => {
  // Placeholders and suggestions are drawn faint.
  assert.equal(draftText(await boxScreen(["❯ \x1b[2mTry \"fix lint errors\"\x1b[22m"])), "");
});



test("shell mode counts as a draft even when empty", async () => {
  // A pasted message would run as a shell command.
  assert.equal(draftText(await boxScreen(["! "])), "!");
  assert.equal(draftText(await boxScreen(["! ls"])), "!ls");
});



test("menus and screens without a box read as empty", async () => {
  // A selection mark without a rule above is not it.
  assert.equal(draftText(await boxScreen([], "  ❯ /help   Show help")), "");
  const plain = createScreen(40, 10);
  await new Promise((resolve) => plain.write(" ❯ No, exit\r\n   Yes, I trust this folder", resolve));
  assert.equal(draftText(plain), "");
});
