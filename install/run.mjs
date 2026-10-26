// Installs, updates, or re-renders the kit inside one project.
// The single path init, update, and render all share.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { KIT_FOLDER } from "../config/defaults.mjs";
import { loadConfig } from "../config/load.mjs";
import { checkoutRoot } from "../config/paths.mjs";
import { applyAgentsBlock } from "./merge/agents-block.mjs";
import { applyGitignore } from "./merge/gitignore.mjs";
import { applyScripts } from "./merge/scripts.mjs";
import { applyClaudeSettings } from "./merge/settings.mjs";
import { defaultAnswers, writeInitialConfig } from "./project/config-file.mjs";
import { scaffoldProject } from "./project/scaffold.mjs";
import { copyKit } from "./template/copy.mjs";
import { linkSkills, renderKitTemplates } from "./template/files.mjs";
import { readManifest, writeManifest } from "./template/manifest.mjs";
import { templateValues } from "./values.mjs";



/**
 * Installs the kit into a project, or refreshes it.
 *
 * Purpose: init adds everything; update and render refresh it.
 *
 * @param options kitRoot, projectRoot, mode (init, update, render),
 *   answers, installPackages, and source and ref to record.
 * @returns Summary of what was written, merged, and skipped.
 *
 * Side effects: Writes the kit, templates, and merged files.
 */
export function installKit({ kitRoot, projectRoot, mode = "init", answers = {}, installPackages = true, source, ref }) {
  // Only git checkouts can host worktrees and pull requests.
  const root = checkoutRoot(projectRoot);
  const full = mode !== "render";
  const summary = { mode, projectRoot: root, configCreated: false, conflicts: [] };

  // Settings first: every template value comes from them.
  if (mode === "init") summary.configCreated = writeInitialConfig(root, { ...defaultAnswers(root), ...definedOnly(answers) });
  const values = templateValues(loadConfig(root, true));
  const manifest = readManifest(root);

  // Kit code, then kit-owned templates and their skill links.
  if (full) summary.kit = copyKit(kitRoot, path.join(root, KIT_FOLDER), { installPackages });
  summary.templates = renderKitTemplates(kitRoot, root, values, manifest.files);
  summary.links = linkSkills(root, summary.templates.files, manifest.links);
  if (full) summary.scaffold = scaffoldProject(kitRoot, root, values);

  // Merge the kit's parts into files the project owns.
  summary.agents = applyAgentsBlock(kitRoot, root, values);
  summary.settings = applyClaudeSettings(root, values, manifest.permissions);
  if (full) summary.scripts = applyScripts(root);
  if (full) summary.gitignore = applyGitignore(root);

  // Remember ownership so the next update can clean up.
  const kit = full ? kitRecord(kitRoot, manifest.kit, { source, ref }) : manifest.kit;
  writeManifest(root, { kit, files: summary.templates.files, links: summary.links.links, permissions: summary.settings.permissions });
  summary.conflicts = collectConflicts(summary);
  return summary;
}



/**
 * Drops answers that were not given.
 *
 * Purpose: Keep detected defaults for missing flags.
 *
 * @param answers Answers that may hold undefined values.
 * @returns Answers with only defined values.
 */
function definedOnly(answers) {
  // Empty strings count as not given too.
  return Object.fromEntries(Object.entries(answers).filter(([, value]) => value !== undefined && value !== ""));
}



/**
 * Describes the kit being installed.
 *
 * Purpose: Record version and commit for later updates.
 *
 * @param kitRoot Kit root being installed from.
 * @param previous Kit record from the last install.
 * @param origin Source and ref this install came from.
 * @returns Kit name, version, commit, source, ref, and time.
 */
function kitRecord(kitRoot, previous, origin) {
  // The kit's own package.json names its version.
  const pkg = JSON.parse(fs.readFileSync(path.join(kitRoot, "package.json"), "utf8"));
  const record = {
    name: pkg.name, version: pkg.version, commit: ownCommit(kitRoot),
    source: origin.source ?? previous?.source ?? null, ref: origin.ref ?? previous?.ref ?? null,
  };

  // The same kit keeps its time, so reruns change nothing.
  const same = previous && ["name", "version", "commit", "source", "ref"].every((key) => previous[key] === record[key]);
  return { ...record, installedAt: same ? previous.installedAt : new Date().toISOString() };
}



/**
 * Reads the kit's commit when it is its own repository.
 *
 * Purpose: Never record the host project's commit by mistake.
 *
 * @param kitRoot Kit root folder.
 * @returns Commit hash, or null.
 */
function ownCommit(kitRoot) {
  // A vendored kit sits inside another repository.
  const top = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: kitRoot, encoding: "utf8" });
  if (top.status !== 0 || fs.realpathSync(top.stdout.trim()) !== fs.realpathSync(kitRoot)) return null;
  const head = spawnSync("git", ["rev-parse", "HEAD"], { cwd: kitRoot, encoding: "utf8" });
  return head.status === 0 ? head.stdout.trim() : null;
}



/**
 * Gathers every conflict the steps reported.
 *
 * Purpose: Show the owner everything left untouched, in one list.
 *
 * @param summary Install summary so far.
 * @returns Conflict messages.
 */
function collectConflicts(summary) {
  // Steps report conflicts in slightly different shapes.
  const failedInstall = summary.kit?.attempted && !summary.kit.installed ? ["npm ci failed in the kit folder; run it there by hand."] : [];
  return [
    ...summary.links.conflicts, ...(summary.agents.conflict ? [summary.agents.conflict] : []),
    ...summary.settings.conflicts, ...(summary.scripts?.conflicts ?? []), ...failedInstall,
  ];
}
