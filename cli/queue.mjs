// Sends, lists, and cancels queued messages, and interrupts sessions.
// Messages wait for a finished turn and an empty box.

/** The sender: this session's name, or the owner outside sessions. */
const SENDER = process.env.COMMAND_CENTER_SESSION ?? "owner";



/**
 * Formats how long ago a time was.
 *
 * Purpose: Keep durations short in one-line output.
 *
 * @param time Epoch milliseconds.
 * @returns Text like 40s, 4m, or 2h.
 */
export function ago(time) {
  // Seconds under a minute, then minutes, then hours.
  const seconds = Math.max(0, Math.round((Date.now() - time) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return seconds < 3600 ? `${Math.round(seconds / 60)}m` : `${Math.round(seconds / 3600)}h`;
}



/**
 * Describes a session's turn in words.
 *
 * Purpose: Tell callers why a message waits.
 *
 * @param turn State and since, from the server.
 * @returns Text like "working (4m)".
 */
export function describeState(turn) {
  // Older servers send no turn; the session still runs.
  if (!turn) return "running";
  if (turn.state === "ended") return "ended";
  return `${turn.state} (${ago(turn.since)})`;
}



/**
 * Queues a message, or types it now with --now.
 *
 * Purpose: Talk to a session without interrupting it.
 *
 * @param call API caller from cc.mjs.
 * @param args Target name, message words, optional --now.
 * @returns Promise resolving when the result is printed.
 */
async function send(call, args) {
  // --now types immediately, for the owner in urgent cases.
  const [name, ...words] = args.filter((arg) => arg !== "--now");
  const text = words.join(" ");
  if (args.includes("--now")) {
    await call(`/input/${encodeURIComponent(name)}`, { text });
    return console.log(`Typed into ${name} now.`);
  }

  // Report delivery, or the wait and how to cancel it.
  const { item, turn } = await call(`/send/${encodeURIComponent(name)}`, { text, from: SENDER });
  if (item.state === "delivered") return console.log(`Delivered to ${name}.`);
  console.log(`Queued #${item.id} for ${name}, which is ${describeState(turn)}. It arrives once that turn ends and nothing is typed in its input box.`);
  console.log(`Cancel it with: npm run cc -- queue cancel ${item.id}`);
}



/**
 * Lists the queue, or cancels one message.
 *
 * Purpose: Let the owner and assistant review and retract messages.
 *
 * @param call API caller from cc.mjs.
 * @param args Empty, or "cancel" and a message id.
 * @returns Promise resolving when the result is printed.
 */
async function queue(call, args) {
  // Cancelling needs the id from the list.
  if (args[0] === "cancel") {
    const item = await call(`/cancel/${encodeURIComponent(args[1])}`, {});
    return console.log(`Cancelled #${item.id} for ${item.to}.`);
  }
  const items = await call("/queue");
  if (!items.length) return console.log("The queue is empty.");
  for (const item of items) {
    // Waiting messages say what holds them.
    const when = ago(item.doneAt ?? item.createdAt);
    const state = item.state === "waiting" && item.hold ? `waiting (${item.hold})` : item.state;
    console.log(`#${item.id} ${item.from} → ${item.to}  ${state} ${when}  ${item.text.replace(/\s+/g, " ").slice(0, 90)}`);
  }
}



/**
 * Presses Escape in a session.
 *
 * Purpose: Stop a delivered task when the owner asks.
 *
 * @param call API caller from cc.mjs.
 * @param args Target session name.
 * @returns Promise resolving when the result is printed.
 */
async function interrupt(call, [name]) {
  // The guard lets only the assistant do this.
  await call(`/interrupt/${encodeURIComponent(name)}`, {});
  console.log(`Pressed Escape in ${name}; its current turn stops.`);
}



/** Queue commands by name, for cc.mjs to dispatch. */
export const QUEUE_COMMANDS = { send, queue, interrupt };
