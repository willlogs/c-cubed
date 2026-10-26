// Guesses a project's owner, trunk, setup, checks, and hexagonal roots.
// Init offers these as defaults; setup confirms them.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/** Lockfiles and the install each one implies, in priority order. */
const INSTALLERS = [
  { lockfile: "package-lock.json", setup: "npm ci --no-audit --no-fund --loglevel=error", run: "npm run" },
  { lockfile: "pnpm-lock.yaml", setup: "pnpm install --frozen-lockfile", run: "pnpm run" },
  { lockfile: "yarn.lock", setup: "yarn install --frozen-lockfile", run: "yarn" },
];

/** Scripts used as checks when no verify script exists. */
const FALLBACK_CHECKS = ["typecheck", "lint", "test"];

/** npm's placeholder test script, which always fails. */
const PLACEHOLDER_TEST = /no test specified/;



/**
 * Runs git and returns its output, or an empty string.
 *
 * Purpose: Detection must never fail init.
 *
 * @param args Arguments after git.
 * @param cwd Project folder.
 * @returns Trimmed output; empty on failure.
 */
function gitText(args, cwd) {
  // Failures mean "unknown", not an error.
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
}



/**
 * Guesses the project's owner from git.
 *
 * Purpose: Default the person who decides.
 *
 * @param root Project checkout root.
 * @returns git's user.name, or an empty string.
 */
export function detectOwner(root) {
  // The person installing is usually the owner.
  return gitText(["config", "user.name"], root);
}



/**
 * Guesses the trunk branch.
 *
 * Purpose: Point pull requests and checks at the right base.
 *
 * @param root Project checkout root.
 * @returns origin's default branch, else the current one, else main.
 */
export function detectTrunk(root) {
  // origin's HEAD beats whatever branch is checked out.
  const remote = gitText(["symbolic-ref", "--short", "refs/remotes/origin/HEAD"], root).replace(/^origin\//, "");
  return remote || gitText(["branch", "--show-current"], root) || "main";
}



/**
 * Finds the lockfile and its install command.
 *
 * Purpose: Prepare each new worktree the way the project does.
 *
 * @param root Project checkout root.
 * @returns Installer entry, or null without a lockfile.
 */
export function detectInstaller(root) {
  // The first lockfile present decides the package manager.
  return INSTALLERS.find((item) => fs.existsSync(path.join(root, item.lockfile))) ?? null;
}



/**
 * Lists the project's own checks from package.json scripts.
 *
 * Purpose: Seed the gate cc check and verify run.
 *
 * @param root Project checkout root.
 * @returns Checks as name and command; none without scripts.
 */
export function detectChecks(root) {
  // No package.json means checks are set during setup.
  const file = path.join(root, "package.json");
  if (!fs.existsSync(file)) return [];
  let scripts = {};
  try {
    scripts = JSON.parse(fs.readFileSync(file, "utf8")).scripts ?? {};
  } catch {
    return [];
  }

  // A verify script is the gate; else the usual trio.
  const run = detectInstaller(root)?.run ?? "npm run";
  const names = scripts.verify ? ["verify"] : FALLBACK_CHECKS.filter((name) => scripts[name] && !PLACEHOLDER_TEST.test(scripts[name]));
  return names.map((name) => ({ name, run: `${run} ${name}` }));
}



/**
 * Finds application roots with a composition root.
 *
 * Purpose: Turn on the hexagonal checker where it applies.
 *
 * @param root Project checkout root.
 * @returns Relative roots such as apps/server, or ".".
 */
export function detectHexagonalRoots(root) {
  // Look one level under apps and packages, and the root.
  const candidates = ["."];
  for (const parent of ["apps", "packages"]) {
    const dir = path.join(root, parent);
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).filter((item) => item.isDirectory())) candidates.push(`${parent}/${entry.name}`);
  }
  return candidates.filter((candidate) => fs.existsSync(path.join(root, candidate, "src", "composition.ts"))).sort();
}
