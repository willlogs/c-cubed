// Holds messages for busy sessions and delivers them between turns.
// Nobody interrupts a session mid-task; the owner can cancel.

import { typeMessage } from "../sessions/input.mjs";
import { requireSession } from "../sessions/terminals.mjs";
import { formatBatch, holdReason } from "./rules.mjs";

/** How long delivered and cancelled messages stay listed. */
const HISTORY_MS = 30 * 60_000;

/** Every message still listed, oldest first. */
let items = [];

/** Id for the next message. */
let nextId = 1;

/** Callbacks told when the queue changes. */
const listeners = new Set();



/**
 * Subscribes to queue changes.
 *
 * Purpose: Let the hub push the queue to browsers.
 *
 * @param listener Callback with no arguments.
 * @returns Function that removes the subscription.
 */
export function onQueueChange(listener) {
  // Return an unsubscribe handle for symmetry with sessions.
  listeners.add(listener);
  return () => listeners.delete(listener);
}



/**
 * Tells every listener the queue changed.
 *
 * Purpose: Keep fan-out in one place.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
function changed() {
  // A failing listener never breaks delivery.
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      listeners.delete(listener);
    }
  }
}



/**
 * Queues a message for a session.
 *
 * Purpose: Reach a busy session without interrupting it.
 *
 * @param message Target name, sender name, and text.
 * @returns The queued item, possibly already delivered.
 */
export function enqueue({ to, from, text }) {
  // Only live sessions can receive messages.
  if (!String(text ?? "").trim()) throw new Error("A message needs text.");
  if (!requireSession(to).alive) throw new Error(`${to} has ended.`);
  const item = { id: nextId++, to, from: from || "owner", text: String(text).trim(), state: "waiting", createdAt: Date.now() };
  items.push(item);

  // A free target gets it right away.
  deliverDue();
  changed();
  return { ...item };
}



/**
 * Cancels a message that is still waiting.
 *
 * Purpose: Let the owner retract a request before it arrives.
 *
 * @param id Message id.
 * @returns The cancelled item.
 */
export function cancelMessage(id) {
  // Delivered messages are already in the session's hands.
  const item = items.find((entry) => entry.id === Number(id));
  if (!item) throw new Error(`No queued message #${id}.`);
  if (item.state !== "waiting") throw new Error(`#${id} was already ${item.state}.`);
  settle([item], "cancelled");
  return { ...item };
}



/**
 * Lists waiting messages and recent history.
 *
 * Purpose: Feed the CLI and the page.
 *
 * Inputs: None.
 *
 * @returns Copies of listed items, oldest first.
 */
export function listQueue() {
  // Forget history older than half an hour.
  const cutoff = Date.now() - HISTORY_MS;
  items = items.filter((item) => item.state === "waiting" || item.doneAt > cutoff);
  return items.map((item) => ({ ...item }));
}



/**
 * Marks items finished with one state.
 *
 * Purpose: Share bookkeeping for delivery, cancel, and ended targets.
 *
 * @param batch Items to finish.
 * @param state New state, such as delivered.
 * @returns No value.
 */
function settle(batch, state) {
  // Every finished item records when it finished; nothing holds it.
  const now = Date.now();
  for (const item of batch) Object.assign(item, { state, doneAt: now, hold: "" });
  changed();
}



/**
 * Delivers waiting messages to every free target.
 *
 * Purpose: Run on a timer and after each new message.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
export function deliverDue() {
  // Group waiting messages by target.
  const due = Map.groupBy(items.filter((item) => item.state === "waiting"), (item) => item.to);
  for (const [to, batch] of due) {
    // Ended targets drop their mail.
    let session;
    try {
      session = requireSession(to);
    } catch {
      settle(batch, "dropped");
      continue;
    }
    if (!session.alive) {
      settle(batch, "dropped");
      continue;
    }

    // Free targets get everything; held ones say why.
    const hold = holdReason(session);
    if (!hold) {
      typeMessage(to, formatBatch(batch));
      settle(batch, "delivered");
    } else if (batch.some((item) => item.hold !== hold)) {
      for (const item of batch) item.hold = hold;
      changed();
    }
  }
}



/**
 * Starts the delivery timer.
 *
 * Purpose: Deliver as soon as a target finishes its turn.
 *
 * Inputs: None.
 *
 * @returns Function that stops the timer.
 */
export function startDelivery() {
  // One check a second is quick enough for people.
  const timer = setInterval(deliverDue, 1000);
  return () => clearInterval(timer);
}
