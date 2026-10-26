// Checks turn tracking and when the queue may deliver.
// Run: node --test tools/command-center/server/queue/delivery.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { describeTurn, eventSession, noteEvent, notePrompt, resetTurn } from "../sessions/activity.mjs";
import { PORT } from "../sessions/env.mjs";
import { createScreen } from "../sessions/screen/mirror.mjs";
import { formatBatch, holdReason, readyForMessage } from "./rules.mjs";



/**
 * Builds a fake live session started a while ago.
 *
 * Purpose: Test turn logic without a terminal.
 *
 * @param name Session name.
 * @returns Session summary like listSessions returns.
 */
function fakeSession(name) {
  // Old enough that the start grace period is over.
  resetTurn(name);
  return { name, alive: true, startedAt: Date.now() - 60_000, meta: { sessionId: `${name}-id` } };
}



/**
 * Builds a hook event from this command center.
 *
 * Purpose: Keep test events short.
 *
 * @param name Session name.
 * @param event Hook event name.
 * @param agoMs How long ago it happened.
 * @param extra Other event fields.
 * @returns Hook event like the recorder writes.
 */
function hookEvent(name, event, agoMs, extra = {}) {
  // Timestamps in the past let settle times pass.
  return { at: new Date(Date.now() - agoMs).toISOString(), name, port: String(PORT), event, ...extra };
}



test("turns move from idle to working to waiting to idle", () => {
  // Prompts start work, permission prompts wait, Stop ends it.
  const master = fakeSession("master");
  const sessions = [master];
  noteEvent(hookEvent("master", "SessionStart", 30_000), sessions);
  assert.equal(describeTurn(master).state, "idle");
  notePrompt("master");
  assert.equal(describeTurn(master).state, "working");
  noteEvent(hookEvent("master", "Notification", 0, { notification: "permission_prompt" }), sessions);
  assert.equal(describeTurn(master).state, "waiting");
  noteEvent(hookEvent("master", "Stop", -1), sessions);
  assert.equal(describeTurn(master).state, "idle");
});



test("events from other command centers or terminals are ignored", () => {
  // Names only count with our port; ids match launched sessions.
  const sessions = [fakeSession("master")];
  assert.equal(eventSession({ name: "master", port: "9999" }, sessions), null);
  assert.equal(eventSession({ session: "master-id" }, sessions), "master");
  assert.equal(eventSession({ session: "someone-else" }, sessions), null);
});



test("delivery waits for a settled idle turn and no typing", () => {
  // Fresh stops and recent keystrokes both hold messages back.
  const master = fakeSession("master");
  noteEvent(hookEvent("master", "SessionStart", 60_000), [master]);
  noteEvent(hookEvent("master", "Stop", 500), [master]);
  assert.equal(readyForMessage(master), false);
  noteEvent(hookEvent("master", "Stop", 5_000), [master]);
  assert.equal(readyForMessage({ ...master, lastKeyAt: Date.now() - 1_000 }), false);
  assert.equal(readyForMessage({ ...master, lastKeyAt: Date.now() - 60_000 }), true);
});



test("a draft in the input box holds messages", async () => {
  // Settled and quiet, but something is typed in the box.
  const master = fakeSession("master");
  noteEvent(hookEvent("master", "SessionStart", 60_000), [master]);
  noteEvent(hookEvent("master", "Stop", 30_000), [master]);
  const screen = createScreen(40, 6);
  const rule = "─".repeat(40);
  await new Promise((resolve) => screen.write(`${rule}\r\n❯ half a thought\r\n${rule}`, resolve));
  assert.equal(holdReason({ ...master, screen }), "draft");

  // Clearing the box frees it.
  await new Promise((resolve) => screen.write("\x1b[2;3H\x1b[K", resolve));
  assert.equal(holdReason({ ...master, screen }), "");
});



test("batches name every sender", () => {
  // One message stays bare; several get a header.
  const one = [{ from: "assistant", text: "check #47" }];
  assert.equal(formatBatch(one), "[from assistant] check #47");
  const two = [...one, { from: "issue-40-x", text: "PR ready" }];
  assert.match(formatBatch(two), /^2 queued messages, oldest first:\n\n\[from assistant\] check #47\n\n\[from issue-40-x\] PR ready$/);
});
