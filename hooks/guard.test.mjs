// Checks which commands the command-center guard blocks.
// Run with: node --test tools/command-center/hooks/guard.test.mjs

import assert from "node:assert/strict";
import test from "node:test";
import { blockReason } from "./guard.mjs";

/** A worker inside the live command center. */
const WORKER = { COMMAND_CENTER_SESSION: "issue-40-x", COMMAND_CENTER_ROLE: "worker", COMMAND_CENTER_PORT: "8095", COMMAND_CENTER_PID: "4242" };

/** The assistant inside the live command center. */
const ASSISTANT = { ...WORKER, COMMAND_CENTER_SESSION: "assistant", COMMAND_CENTER_ROLE: "assistant" };



test("blocks commands that stop or replace the live server", () => {
  // Each of these would end every session.
  for (const command of [
    "pkill -f node",
    "killall claude",
    "kill 4242",
    "kill -9 $COMMAND_CENTER_PID",
    "fuser -k 8095/tcp",
    "kill $(lsof -t -i :8095)",
    "npm run command-center",
    "node tools/command-center/server/main.mjs",
    "COMMAND_CENTER_PORT=8095 node server/main.mjs --no-master",
    "COMMAND_CENTER_PORT=8097 node server/main.mjs",
    "npm run cc -- stop master",
    "curl -X POST http://127.0.0.1:8095/api/stop/assistant",
    "npm run cc -- interrupt master",
  ]) assert.ok(blockReason(command, WORKER), command);
});



test("allows normal work and private test copies", () => {
  // Reading files, tests, and copies on other ports stay allowed.
  for (const command of [
    "cat tools/command-center/server/main.mjs",
    "node --check server/main.mjs",
    "COMMAND_CENTER_PORT=8097 node server/main.mjs --no-master --no-open",
    "kill 9131",
    "pkill -f vite",
    "npm run cc -- send master \"[issue-40] PR #47 ready\"",
    "npm run cc -- stop issue-40-x",
    "npm run verify",
  ]) assert.equal(blockReason(command, WORKER), null, command);
});



test("lets only the assistant interrupt, and ignores outside terminals", () => {
  // the owner's own terminals carry no session variables.
  assert.equal(blockReason("npm run cc -- interrupt master", ASSISTANT), null);
  assert.equal(blockReason("pkill -f node", {}), null);
});
