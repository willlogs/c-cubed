// Reads and writes the project version and its changelog.
// command-center.json names the file and the number's pattern.

import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../config/load.mjs";
import { prependSection } from "./changelog/section.mjs";
import { git } from "./github/gh.mjs";

/** Pattern when versions.pattern is unset: package.json style. */
const DEFAULT_PATTERN = "\"version\":\\s*\"([^\"]+)\"";



/**
 * Returns the project's version file settings.
 *
 * Purpose: One place reads versions settings.
 *
 * @param repoRoot Main checkout path.
 * @returns File, pattern with one capture group, changelog, trunk.
 */
export function versionFiles(repoRoot) {
  // The pattern's only group captures the number.
  const { versions, branches } = loadConfig(repoRoot);
  const pattern = new RegExp(versions.pattern ?? DEFAULT_PATTERN, "d");
  return { file: versions.file, pattern, changelog: versions.changelog, trunk: branches.trunk };
}



/**
 * Reads a file as trunk has it, else this checkout.
 *
 * Purpose: Prefer merged truth over a stale checkout.
 *
 * @param repoRoot Main checkout path.
 * @param file Path from the repository root.
 * @returns File text, or an empty string.
 */
function readTrunk(repoRoot, file) {
  // origin's trunk first; the checkout covers unpushed repos.
  try {
    return git(["show", `origin/${versionFiles(repoRoot).trunk}:${file}`], repoRoot);
  } catch {
    const local = path.join(repoRoot, file);
    return fs.existsSync(local) ? fs.readFileSync(local, "utf8") : "";
  }
}



/**
 * Reads the project's current version number.
 *
 * Purpose: The badge, versions, and releases share one truth.
 *
 * @param repoRoot Main checkout path.
 * @returns Number such as 2.1.0; null without versions.
 */
export function readCurrent(repoRoot) {
  // Projects may skip versions entirely.
  const { file, pattern } = versionFiles(repoRoot);
  if (!file) return null;
  const number = pattern.exec(readTrunk(repoRoot, file))?.[1];
  if (!number) throw new Error(`No version number matches versions.pattern in ${file}.`);
  return number;
}



/**
 * Reads the changelog as the trunk has it.
 *
 * Purpose: Show shipped versions' notes.
 *
 * @param repoRoot Main checkout path.
 * @returns Changelog text; empty before the first release.
 */
export function readChangelog(repoRoot) {
  // Missing until the first version ships.
  return readTrunk(repoRoot, versionFiles(repoRoot).changelog);
}



/**
 * Writes a release's version and changelog section.
 *
 * Purpose: Make the release commit's two changes in a worktree.
 *
 * @param dir Worktree folder on the release branch.
 * @param number New version number.
 * @param section Changelog section for this version.
 * @returns The two changed paths.
 *
 * Side effects: Rewrites the version file and changelog in dir.
 */
export function writeRelease(dir, number, section) {
  // Replace only the captured number, keeping everything else.
  const { file, pattern, changelog } = versionFiles(dir);
  const versionPath = path.join(dir, file);
  const text = fs.readFileSync(versionPath, "utf8");
  const match = pattern.exec(text);
  if (!match) throw new Error(`No version number matches versions.pattern in ${file}.`);
  const [start, end] = match.indices[1];
  fs.writeFileSync(versionPath, `${text.slice(0, start)}${number}${text.slice(end)}`);

  // Newest section goes first, under the intro.
  const changelogPath = path.join(dir, changelog);
  const current = fs.existsSync(changelogPath) ? fs.readFileSync(changelogPath, "utf8") : "";
  fs.writeFileSync(changelogPath, prependSection(current, section));
  return [file, changelog];
}
