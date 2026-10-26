// Installs the kit into temporary projects, twice, and compares.
// Covers a fixture kit's edge cases and the real templates.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { updateConfigFile } from "../config/load.mjs";
import { installKit } from "./run.mjs";

/** The real kit, which holds this test. */
const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** A small kit exercising rendering, links, and exclusions. */
const FIXTURE = {
  "package.json": JSON.stringify({ name: "command-center", version: "9.9.9" }),
  "hooks/record.mjs": "// record\n",
  "node_modules/junk/index.js": "junk",
  "templates/kit/.agents/skills/demo/SKILL.md": "{{owner}} on {{trunk}}\n",
  "templates/kit/.agents/skills/demo/scripts/run.py": "print('{{owner}}')\n",
  "templates/kit/.agents/skills/enforce-ts-hexagonal-modules/SKILL.md": "roots: {{hexagonalRoots}}\n",
  "templates/kit/.claude/agents/assistant.md": "model: {{model}}\n",
  "templates/project/AGENTS.md": "# {{project}}\n\n<!-- command-center:rules:start -->\n<!-- command-center:rules:end -->\n",
  "templates/project/vault/00-direction/Decision Register.md": "# Decisions for {{project}}\n",
  "templates/blocks/agents-rules.md": "Owner {{owner}}{{#if hasProduction}}, ships to {{production}}{{/if}}.\n",
};



/**
 * Writes files under a new temporary folder.
 *
 * Purpose: Build fixture kits and projects.
 *
 * @param files Relative paths to contents.
 * @param git Whether to make the folder a repository.
 * @returns Absolute folder path.
 *
 * Side effects: Writes under the system temp folder.
 */
function folder(files, git = false) {
  // Projects need git; kits do not.
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cc-install-"));
  for (const [file, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), content);
  }
  if (git) spawnSync("git", ["init", "--quiet", "-b", "main"], { cwd: root });
  return root;
}



/**
 * Hashes every file and link in a project.
 *
 * Purpose: Compare two installs byte for byte.
 *
 * @param root Project folder.
 * @returns Relative path to content hash or link target.
 */
function snapshot(root) {
  // Start the walk at the project root.
  const result = {};
  walkInto(root, root, result);
  return result;
}



/**
 * Records one folder's files and links, recursively.
 *
 * Purpose: Fill a snapshot without following links.
 *
 * @param root Project folder, for relative paths.
 * @param dir Folder to walk now.
 * @param result Snapshot being filled.
 * @returns No value.
 *
 * Side effects: Adds entries to result.
 */
function walkInto(root, dir, result) {
  // Links record their target; git data is skipped.
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    const relative = path.relative(root, file);
    if (entry.name === ".git") continue;
    if (entry.isSymbolicLink()) result[relative] = `-> ${fs.readlinkSync(file)}`;
    else if (entry.isDirectory()) walkInto(root, file, result);
    else result[relative] = crypto.createHash("sha1").update(fs.readFileSync(file)).digest("hex");
  }
}



/**
 * Reads a project file as text.
 *
 * Purpose: Keep assertions short.
 *
 * @param root Project folder.
 * @param file Relative path.
 * @returns File text.
 */
function read(root, file) {
  // Missing files throw, failing the test clearly.
  return fs.readFileSync(path.join(root, file), "utf8");
}



test("init installs a fixture kit, and a rerun changes nothing", () => {
  // A project with its own hook and a verify script.
  const kit = folder(FIXTURE);
  const settings = JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: "command", command: "echo mine" }] }] } });
  const project = folder({ "package.json": JSON.stringify({ name: "acme", scripts: { verify: "true" } }), ".claude/settings.json": settings }, true);
  const summary = installKit({ kitRoot: kit, projectRoot: project, answers: { owner: "Will", project: "Acme" }, installPackages: false });
  assert.deepEqual(summary.conflicts, []);

  // Kit code copied without packages.
  assert.ok(fs.existsSync(path.join(project, "tools/command-center/hooks/record.mjs")));
  assert.ok(!fs.existsSync(path.join(project, "tools/command-center/node_modules")));

  // Markdown rendered, scripts copied, hexagonal left out.
  assert.equal(read(project, ".agents/skills/demo/SKILL.md"), "Will on main\n");
  assert.equal(read(project, ".agents/skills/demo/scripts/run.py"), "print('{{owner}}')\n");
  assert.equal(read(project, ".claude/agents/assistant.md"), "model: sonnet\n");
  assert.ok(!fs.existsSync(path.join(project, ".agents/skills/enforce-ts-hexagonal-modules")));
  assert.equal(fs.readlinkSync(path.join(project, ".claude/skills/demo")), "../../.agents/skills/demo");

  // Project files, rules block, settings, scripts, ignore.
  assert.match(read(project, "AGENTS.md"), /# Acme\n\n<!-- command-center:rules:start -->\nOwner Will\.\n<!-- command-center:rules:end -->/);
  assert.equal(read(project, "vault/00-direction/Decision Register.md"), "# Decisions for Acme\n");
  const merged = JSON.parse(read(project, ".claude/settings.json"));
  assert.equal(merged.hooks.Stop[0].hooks[0].command, "echo mine");
  assert.equal(JSON.parse(read(project, "package.json")).scripts.cc, "node tools/command-center/cli/cc.mjs");
  assert.match(read(project, ".gitignore"), /tools\/command-center\/node_modules\//);
  assert.deepEqual(JSON.parse(read(project, "command-center.json")).checks, [{ name: "verify", run: "npm run verify" }]);

  // A second install leaves every byte as it was.
  const before = snapshot(project);
  installKit({ kitRoot: kit, projectRoot: project, mode: "update", installPackages: false });
  assert.deepEqual(snapshot(project), before);
});



test("update removes dropped files and follows settings", () => {
  // Install, then drop a file and enable hexagonal and production.
  const kit = folder(FIXTURE);
  const project = folder({}, true);
  installKit({ kitRoot: kit, projectRoot: project, answers: { owner: "Will" }, installPackages: false });
  fs.rmSync(path.join(kit, "templates/kit/.agents/skills/demo"), { recursive: true });
  updateConfigFile(project, (raw) => ({ ...raw, branches: { trunk: "main", production: "prod" }, enforcement: { hexagonal: ["apps/server"] } }));
  installKit({ kitRoot: kit, projectRoot: project, mode: "update", installPackages: false });

  // Dropped skill and its link are gone; hexagonal arrived.
  assert.ok(!fs.existsSync(path.join(project, ".agents/skills/demo")));
  assert.ok(!fs.lstatSync(path.join(project, ".claude/skills/demo"), { throwIfNoEntry: false }));
  assert.equal(read(project, ".agents/skills/enforce-ts-hexagonal-modules/SKILL.md"), "roots: apps/server\n");
  assert.match(read(project, "AGENTS.md"), /Owner Will, ships to prod\./);
  assert.ok(JSON.parse(read(project, ".claude/settings.json")).permissions.deny.includes("Bash(git push origin prod:*)"));
});



test("the register follows a custom decisions path", () => {
  // Settings written before init are kept and used.
  const kit = folder(FIXTURE);
  const project = folder({ "command-center.json": JSON.stringify({ owner: "Will", decisions: "docs/decisions.md" }) }, true);
  const summary = installKit({ kitRoot: kit, projectRoot: project, installPackages: false });
  assert.equal(summary.configCreated, false);
  assert.equal(read(project, "docs/decisions.md"), `# Decisions for ${path.basename(project)}\n`);
  assert.ok(!fs.existsSync(path.join(project, "vault")));
});



test("init installs the real kit, and a rerun changes nothing", () => {
  // The real templates render into a bare repository.
  const project = folder({ "package.json": JSON.stringify({ name: "real", scripts: { test: "node --test" } }) }, true);
  const summary = installKit({ kitRoot: KIT_ROOT, projectRoot: project, answers: { owner: "Will", project: "Real" }, installPackages: false });
  assert.ok(fs.existsSync(path.join(project, "tools/command-center/bin/command-center.mjs")));
  assert.ok(summary.templates.files.length > 0);

  // Every kit skill is linked; rules and register exist.
  for (const link of summary.links.links) assert.ok(fs.lstatSync(path.join(project, link)).isSymbolicLink());
  assert.match(read(project, "AGENTS.md"), /<!-- command-center:rules:start -->[\s\S]+<!-- command-center:rules:end -->/);
  assert.ok(fs.existsSync(path.join(project, "vault/00-direction/Decision Register.md")));
  assert.ok(!fs.existsSync(path.join(project, ".agents/skills/enforce-ts-hexagonal-modules")));

  // No placeholder survives rendering in kit-owned Markdown.
  for (const file of summary.templates.files.filter((item) => item.endsWith(".md"))) assert.doesNotMatch(read(project, file), /\{\{[#/]?\w+/, file);

  // A second install leaves every byte as it was.
  const before = snapshot(project);
  installKit({ kitRoot: KIT_ROOT, projectRoot: project, mode: "update", installPackages: false });
  assert.deepEqual(snapshot(project), before);
});
