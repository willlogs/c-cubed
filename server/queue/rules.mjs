// Decides when queued messages may arrive, and their text.
// Pure rules, kept apart so tests need no running sessions.

import { describeTurn } from "../sessions/activity.mjs";
import { draftText } from "../sessions/screen/prompt.mjs";

/** Quiet time after a turn ends before delivering. */
const SETTLE_MS = 2_000;

/** Keystrokes this recent mean someone is typing a draft. */
const TYPING_MS = 15_000;



/**
 * Joins waiting messages into one submission.
 *
 * Purpose: Spend one target turn, not one per message.
 *
 * @param batch Waiting items for one target, oldest first.
 * @returns Text to type into the target.
 */
export function formatBatch(batch) {
  // Each message names its sender.
  const lines = batch.map((item) => `[from ${item.from}] ${item.text}`);
  if (lines.length === 1) return lines[0];
  return [`${lines.length} queued messages, oldest first:`, ...lines].join("\n\n");
}



/**
 * Says why a session cannot take a message yet.
 *
 * Purpose: Deliver only between turns, never into a draft.
 *
 * @param session Live session record.
 * @returns Reason such as draft, or "" when free.
 */
export function holdReason(session) {
  // Busy turns, then a fresh stop, typing, or a draft.
  const turn = describeTurn(session);
  const now = Date.now();
  if (turn.state !== "idle") return turn.state;
  if (now - turn.since < SETTLE_MS) return "settling";
  if (now - (session.lastKeyAt ?? 0) < TYPING_MS) return "typing";
  return session.screen && draftText(session.screen) ? "draft" : "";
}



/**
 * Tells whether a session can take a message now.
 *
 * Purpose: Keep the delivery check readable.
 *
 * @param session Live session record.
 * @returns True when nothing holds messages back.
 */
export function readyForMessage(session) {
  // Free means no hold reason at all.
  return !holdReason(session);
}
