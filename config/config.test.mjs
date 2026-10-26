// Checks settings merging, reloading, and the setup rules.
// Uses temp folders; never the real project.

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { loadConfig, mergeSettings, updateConfigFile } from "./load.mjs";
import { needsSetup, setupProblems } from "./setup.mjs";



/**
 * Creates a project folder with the given files.
 *
 * Purpose: Each test starts from a known tree.
 *
 * @param files Relative paths mapped to contents.
 * @returns Folder path.
 */
function project(files) {
  // Parents are created as needed.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-config-"));
  for (const [file, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), text);
  }
  return root;
}



test("settings merge objects and replace arrays and null", () => {
  // Projects set only what differs.
  const merged = mergeSettings({ a: { b: 1, c: 2 }, list: [1], keep: null }, { a: { c: 3 }, list: [2], keep: { x: 1 } });
  assert.deepEqual(merged, { a: { b: 1, c: 3 }, list: [2], keep: { x: 1 } });
});



test("defaults fill in, stacks get theirs, and edits reload", () => {
  // A file with only a stacks start command.
  const root = project({ "command-center.json": JSON.stringify({ owner: "Ada", stacks: { start: "run" } }) });
  const first = loadConfig(root);
  assert.equal(first.ownerName, "Ada");
  assert.equal(first.branches.trunk, "main");
  assert.equal(first.stacks.max, 3);

  // A later write is seen without a restart.
  updateConfigFile(root, (raw) => ({ ...raw, owner: "Grace" }));
  assert.equal(loadConfig(root).ownerName, "Grace");
});



test("setup lasts until rules and decisions exist", () => {
  // Placeholders and an empty register keep setup open.
  const register = "| ID | Decision | Consequence | Enforced by |\n| --- | --- | --- | --- |\n";
  const root = project({
    "command-center.json": JSON.stringify({ project: "Demo", owner: "Ada" }),
    "AGENTS.md": "<!-- command-center:rules:start -->\n<!-- command-center:rules:end -->\n<!-- setup: repo map -->\n",
    "vault/00-direction/Decision Register.md": register,
  });
  assert.equal(needsSetup(root), true);
  assert.equal(setupProblems(root).length, 2);

  // Filling both ends setup.
  fs.writeFileSync(path.join(root, "AGENTS.md"), "<!-- command-center:rules:start -->\n<!-- command-center:rules:end -->\nRepo map.\n");
  fs.appendFileSync(path.join(root, "vault/00-direction/Decision Register.md"), "| D01 | One trunk | PRs only | guard hook |\n");
  assert.deepEqual(setupProblems(root), []);
  assert.equal(needsSetup(root), false);
});
