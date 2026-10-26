// Answers the queue's HTTP calls: send, list, cancel, and interrupt.
// The cc CLI and the page share these routes.

import { describeTurn } from "../sessions/activity.mjs";
import { pressEscape } from "../sessions/input.mjs";
import { requireSession } from "../sessions/terminals.mjs";
import { cancelMessage, enqueue, listQueue } from "./store.mjs";

/** Route names this module answers. */
export const QUEUE_ROUTES = ["send", "queue", "cancel", "interrupt"];



/**
 * Answers one queue route.
 *
 * Purpose: Keep queue routing out of the main router.
 *
 * @param name Route name from QUEUE_ROUTES.
 * @param target Session name or message id from the path.
 * @param body Parsed JSON body, empty for GET.
 * @returns Status code and JSON value.
 */
export function answerQueue(name, target, body) {
  // Sending reports the target's state, so callers can explain waits.
  if (name === "send") {
    const item = enqueue({ to: target, from: body.from, text: body.text });
    return [201, { item, turn: describeTurn(requireSession(target)) }];
  }
  if (name === "queue") return [200, listQueue()];
  if (name === "cancel") return [200, cancelMessage(target)];

  // Interrupting presses Escape in a live session.
  if (!requireSession(target).alive) throw new Error(`${target} has ended.`);
  pressEscape(target);
  return [200, { ok: true }];
}
