// Types keystrokes and messages into live sessions.
// Submitted input counts as work starting, for the queue.

import { notePrompt } from "./activity.mjs";
import { announceSessions, requireSession } from "./terminals.mjs";

/** Focus and mouse reports the browser terminal sends; not typing. */
const REPORTS = /^(?:\x1b\[[IO]|\x1b\[<\d+;\d+;\d+[Mm])+$/;



/**
 * Types input into a live session.
 *
 * Purpose: Track submitted messages and who has talked to it.
 *
 * @param name Session name.
 * @param data Keystrokes or pasted text.
 * @returns No value.
 */
export function writeInput(name, data) {
  // Enter submits a message; terminal replies never contain it.
  const session = requireSession(name);
  if (!session.alive) return;
  session.terminal.write(data);
  if (!REPORTS.test(data)) session.lastKeyAt = Date.now();
  if (!data.includes("\r")) return;
  notePrompt(name);
  session.typed = true;
  announceSessions();
}



/**
 * Types a message into a session and submits it.
 *
 * Purpose: Let the owner, queue, and sessions reach sessions.
 *
 * @param name Session name.
 * @param text Message text, possibly multi-line.
 * @returns No value.
 */
export function typeMessage(name, text) {
  // Bracketed paste keeps newlines inside one message.
  writeInput(name, `\x1b[200~${text}\x1b[201~\r`);
}



/**
 * Presses Escape in a session.
 *
 * Purpose: Interrupt a turn when the owner asks.
 *
 * @param name Session name.
 * @returns No value.
 */
export function pressEscape(name) {
  // Claude stops its current turn on Escape.
  writeInput(name, "\x1b");
}
