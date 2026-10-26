// Checks stack names, limits, ports, commands, and a real start.
// One test starts a tiny server in a temp repo.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertDevelopmentHost, assertInstanceName } from "../names.mjs";
import { expandCommand, stackEnv } from "../stacks/commands.mjs";
import { assertCapacity, startStack, stopStack } from "../stacks/lifecycle.mjs";
import { choosePorts } from "../stacks/ports.mjs";
import { readRegistry } from "../stacks/registry.mjs";
import { describeStatus } from "../stacks/status.mjs";

/** A one-line server that answers on $PORT. */
const SERVER = "node -e \"require('http').createServer((q, s) => s.end('ok')).listen(process.env.PORT)\"";



/**
 * Creates a git repository with stack settings.
 *
 * Purpose: Run the real lifecycle without the real project.
 *
 * @param stacks Stacks block for command-center.json.
 * @returns Repository folder.
 */
function stackRepo(stacks) {
  // State lives inside the temp folder, never the user's.
  const repo = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "cc-stacks-")));
  spawnSync("git", ["init", "--quiet", repo]);
  fs.writeFileSync(path.join(repo, "command-center.json"), JSON.stringify({ stacks }));
  return repo;
}



test("names and hosts are checked before anything runs", () => {
  // Names become branches and folders.
  assert.equal(assertInstanceName("issue-4-fix"), "issue-4-fix");
  assert.throws(() => assertInstanceName("Bad Name"), /must match/);
  assert.throws(() => assertDevelopmentHost({ NODE_ENV: "production" }), /refuse/);
  assert.throws(() => assertDevelopmentHost({ FLY_APP_NAME: "shop" }), /FLY_APP_NAME/);
  assert.doesNotThrow(() => assertDevelopmentHost({ NODE_ENV: "development" }));
});



test("a full host refuses new stacks but allows restarts", () => {
  // Two running stacks fill a limit of two.
  const registry = { instances: { "issue-1": {}, "issue-2": {} } };
  assert.throws(() => assertCapacity(registry, "issue-3", 2), /limit is 2/);
  assert.doesNotThrow(() => assertCapacity(registry, "issue-2", 2));
});



test("port blocks skip reserved, taken, and busy ports", async () => {
  // 4100 is taken and 4111 busy, so 4120 wins.
  const ports = await choosePorts(["app", "web"], [4100], async (port) => port !== 4111);
  assert.deepEqual(ports, { app: 4120, web: 4121 });
});



test("commands get placeholders and variables", () => {
  // Unknown placeholders stay as written.
  const record = { name: "pr-4", worktree: "/wt/pr-4", ports: { app: 4100, "api-x": 4101 } };
  assert.equal(expandCommand("up {name} {worktree} {port.app} {port.api-x} {other}", record), "up pr-4 /wt/pr-4 4100 4101 {other}");
  const env = stackEnv(record);
  assert.equal(env.PORT, "4100");
  assert.equal(env.CC_PORT_API_X, "4101");
  assert.equal(env.CC_INSTANCE, "pr-4");
});



test("a background stack starts, answers, and stops", async () => {
  // Run inside a throwaway repository with its own state.
  const repo = stackRepo({ start: SERVER, ports: ["app"], url: "http://127.0.0.1:{port.app}/" });
  const previous = { cwd: process.cwd(), state: process.env.COMMAND_CENTER_STATE };
  process.env.COMMAND_CENTER_STATE = path.join(repo, ".state");
  process.chdir(repo);
  try {
    // Start, check it answers, then stop it.
    const record = await startStack("demo", repo);
    const status = await describeStatus();
    assert.equal(status.instances[0].state, "running");
    assert.equal(status.instances[0].url, `http://127.0.0.1:${record.ports.app}/`);
    assert.equal(await (await fetch(status.instances[0].url)).text(), "ok");
    await stopStack("demo");
    assert.deepEqual(readRegistry().instances, {});
  } finally {
    process.chdir(previous.cwd);
    if (previous.state === undefined) delete process.env.COMMAND_CENTER_STATE;
    else process.env.COMMAND_CENTER_STATE = previous.state;
  }
});
