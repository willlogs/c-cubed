// Tests project detection and the first settings file.
// Defaults must be right without asking anything.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { initialConfig, writeInitialConfig } from "./config-file.mjs";
import { detectChecks, detectHexagonalRoots, detectInstaller, detectTrunk } from "./detect.mjs";



/**
 * Creates a temporary project with some files.
 *
 * Purpose: Give each test its own folder.
 *
 * @param files Relative paths to contents.
 * @returns Absolute folder path.
 *
 * Side effects: Writes files under the system temp folder.
 */
function project(files) {
  // Parent folders are created as needed.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-detect-"));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  return root;
}



test("detects checks, preferring verify", () => {
  // verify alone is the whole gate.
  const withVerify = project({ "package.json": JSON.stringify({ scripts: { verify: "x", test: "y" } }), "package-lock.json": "{}" });
  assert.deepEqual(detectChecks(withVerify), [{ name: "verify", run: "npm run verify" }]);

  // Otherwise the usual trio, minus npm's placeholder test.
  const placeholder = 'echo "Error: no test specified" && exit 1';
  const plain = project({ "package.json": JSON.stringify({ scripts: { lint: "eslint .", test: placeholder } }), "pnpm-lock.yaml": "" });
  assert.deepEqual(detectChecks(plain), [{ name: "lint", run: "pnpm run lint" }]);
  assert.equal(detectInstaller(plain).setup, "pnpm install --frozen-lockfile");
  assert.deepEqual(detectChecks(project({})), []);
});



test("detects hexagonal roots by composition root", () => {
  // Only folders with src/composition.ts count.
  const root = project({ "apps/server/src/composition.ts": "", "apps/client/src/main.ts": "", "src/composition.ts": "" });
  assert.deepEqual(detectHexagonalRoots(root), [".", "apps/server"]);
});



test("detects the trunk of a new repository", () => {
  // An unborn branch still has a name.
  const root = project({});
  spawnSync("git", ["init", "--quiet", "-b", "trunk"], { cwd: root });
  assert.equal(detectTrunk(root), "trunk");
});



test("writes only differing settings, once", () => {
  // npm projects keep the default lockfile list.
  const root = project({ "package.json": JSON.stringify({ scripts: { test: "node --test" } }), "package-lock.json": "{}" });
  const raw = initialConfig(root, { project: "Acme", owner: "Will", trunk: "main" });
  assert.deepEqual(raw.worktrees, { setup: ["npm ci --no-audit --no-fund --loglevel=error"], lockfiles: ["package-lock.json"] });
  assert.equal(raw.kit, undefined);
  assert.equal(raw.setup, undefined);

  // A second write never replaces the file.
  assert.equal(writeInitialConfig(root, { project: "Acme", owner: "Will", trunk: "main" }), true);
  assert.equal(writeInitialConfig(root, { project: "Other", owner: "X", trunk: "dev" }), false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(root, "command-center.json"), "utf8")).project, "Acme");
});
