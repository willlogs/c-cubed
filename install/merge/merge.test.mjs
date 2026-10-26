// Tests merging settings, the AGENTS.md block, scripts, and .gitignore.
// Project entries must survive every install and update.

import assert from "node:assert/strict";
import test from "node:test";
import { MARKERS, mergeAgentsBlock } from "./agents-block.mjs";
import { mergeGitignore } from "./gitignore.mjs";
import { KIT_SCRIPTS, mergeScripts, packageName } from "./scripts.mjs";
import { kitSettings, mergeClaudeSettings } from "./settings.mjs";

/** Values with every branch set. */
const VALUES = { trunk: "master", staging: "staging", production: "production" };

/** A project's own hook, which must always survive. */
const PROJECT_HOOK = { matcher: "Bash", hooks: [{ type: "command", command: "node scripts/lint-hook.mjs" }] };



test("settings merge into an empty file", () => {
  // Every kit event, guard, status line, and branch rule.
  const { settings, permissions } = mergeClaudeSettings({}, kitSettings(VALUES));
  assert.deepEqual(Object.keys(settings.hooks), ["SessionStart", "UserPromptSubmit", "PreToolUse", "Notification", "Stop", "SubagentStart", "SubagentStop"]);
  assert.equal(settings.hooks.PreToolUse[1].hooks[0].command, 'node "$CLAUDE_PROJECT_DIR/tools/command-center/hooks/guard.mjs"');
  assert.match(settings.statusLine.command, /tools\/command-center\/cli\/statusline\.mjs/);
  assert.ok(settings.permissions.deny.includes("Bash(git push origin production:*)"));
  assert.ok(settings.permissions.allow.includes("Bash(git rebase origin/master:*)"));
  assert.deepEqual(permissions.allow, settings.permissions.allow);
});



test("settings merge is idempotent and keeps project entries", () => {
  // Project hooks, rules, and keys survive two merges.
  const current = { model: "opus", hooks: { PreToolUse: [PROJECT_HOOK] }, permissions: { allow: ["Bash(make:*)", "Bash(git status:*)"], deny: [] } };
  const first = mergeClaudeSettings(current, kitSettings(VALUES));
  const second = mergeClaudeSettings(first.settings, kitSettings(VALUES), first.permissions);
  assert.deepEqual(second.settings, first.settings);
  assert.equal(first.settings.model, "opus");
  assert.deepEqual(first.settings.hooks.PreToolUse[0], PROJECT_HOOK);

  // A rule the project had stays the project's.
  assert.ok(!first.permissions.allow.includes("Bash(git status:*)"));
  assert.ok(first.settings.permissions.allow.includes("Bash(make:*)"));
});



test("settings merge replaces old kit entries", () => {
  // A trunk rename drops the old kit rules and hooks.
  const old = mergeClaudeSettings({}, kitSettings({ trunk: "main" }));
  old.settings.hooks.Stop.push({ hooks: [{ type: "command", command: 'node "$CLAUDE_PROJECT_DIR/tools/command-center/hooks/old.mjs"' }] });
  const next = mergeClaudeSettings(old.settings, kitSettings(VALUES), old.permissions);
  assert.ok(!next.settings.permissions.deny.includes("Bash(git push origin main:*)"));
  assert.ok(next.settings.permissions.deny.includes("Bash(git push origin master:*)"));
  assert.ok(!JSON.stringify(next.settings.hooks).includes("old.mjs"));
  assert.equal(next.settings.hooks.Stop.length, 1);
});



test("a project's own status line is kept", () => {
  // Reported, never replaced.
  const merged = mergeClaudeSettings({ statusLine: { type: "command", command: "my-line" } }, kitSettings(VALUES));
  assert.equal(merged.settings.statusLine.command, "my-line");
  assert.equal(merged.statusLineKept, true);
});



test("agents block replaces between markers and appends otherwise", () => {
  // Text outside the markers never changes.
  const text = `# Rules\n\nmine\n${MARKERS.start}\nold\n${MARKERS.end}\n\nafter\n`;
  const replaced = mergeAgentsBlock(text, "new rules\n");
  assert.equal(replaced.text, `# Rules\n\nmine\n${MARKERS.start}\nnew rules\n${MARKERS.end}\n\nafter\n`);
  assert.equal(mergeAgentsBlock(replaced.text, "new rules").changed, false);

  // A file without markers gets the block at the end.
  const appended = mergeAgentsBlock("# Rules\nmine\n", "kit");
  assert.ok(appended.text.startsWith("# Rules\nmine\n\n<!--"));
  assert.ok(appended.text.endsWith(`${MARKERS.start}\nkit\n${MARKERS.end}\n`));
});



test("a lone agents marker is a conflict", () => {
  // Someone edited the markers; leave the file alone.
  const merged = mergeAgentsBlock(`x\n${MARKERS.start}\ny\n`, "kit");
  assert.equal(merged.changed, false);
  assert.match(merged.conflict, /one rules marker/);
});



test("scripts are added without overwriting", () => {
  // Missing package.json becomes a private one.
  const created = mergeScripts(null, "acme");
  assert.deepEqual(created.pkg.scripts, KIT_SCRIPTS);
  assert.equal(created.pkg.private, true);

  // Same scripts are fine; different ones are conflicts.
  const pkg = { name: "x", scripts: { test: "vitest", cc: "something else", status: KIT_SCRIPTS.status } };
  const merged = mergeScripts(pkg, "x");
  assert.deepEqual(merged.added, ["command-center", "instances"]);
  assert.equal(merged.pkg.scripts.cc, "something else");
  assert.equal(merged.conflicts.length, 1);
  assert.equal(packageName("My Project!"), "my-project");
});



test("gitignore gets the kit line unless covered", () => {
  // An unanchored node_modules rule already covers the kit.
  assert.equal(mergeGitignore("node_modules/\n").changed, false);
  assert.equal(mergeGitignore("dist").text, "dist\ntools/command-center/node_modules/\n");
  assert.equal(mergeGitignore("").text, "tools/command-center/node_modules/\n");
});
