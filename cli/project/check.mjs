// Runs the project's gate: its own checks, then enforcement.
// Workers run it before PRs; cc verify, before merges.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { KIT_FOLDER } from "../../config/defaults.mjs";
import { loadLocalConfig } from "../../config/load.mjs";
import { mainCheckout } from "../../config/paths.mjs";

/** Where the kit renders its enforcement skills. */
const SKILLS = ".agents/skills";



/**
 * Lists every step the gate runs, in order.
 *
 * Purpose: Project checks first, then the kit's checkers.
 *
 * @param config Settings of the checkout being checked.
 * @param since Base ref of the change; null means uncommitted.
 * @returns Steps with name, command, and arguments.
 */
export function gateSteps(config, since) {
  // Project checks are shell commands from the settings.
  const scope = since ? ["--since", since] : ["--changed"];
  const steps = config.checks.map((check) => ({ name: check.name, command: "sh", args: ["-c", check.run] }));
  const { readableCode, maxFolderFiles, hexagonal } = config.enforcement;

  // Readable code covers every changed file, any language.
  if (readableCode) {
    const script = path.join(config.root, SKILLS, "write-readable-code/scripts/check_readability.py");
    const typescript = typescriptFolder(config.root);
    steps.push({ name: "readable code", command: "python3", args: [script, ...scope, "--max-folder-files", String(maxFolderFiles), ...(typescript ? ["--typescript", typescript] : [])], needs: script });
  }

  // The hexagonal scanner runs once per backend root.
  for (const root of hexagonal) {
    const script = path.join(config.root, SKILLS, "enforce-ts-hexagonal-modules/scripts/check-architecture.mjs");
    const typescript = typescriptFolder(config.root);
    steps.push({ name: `hexagonal ${root}`, command: process.execPath, args: [script, "--root", root, ...scope, ...(typescript ? ["--typescript", typescript] : [])], needs: script });
  }
  return steps;
}



/**
 * Finds a folder that resolves the typescript package.
 *
 * Purpose: Check JS and TS even in projects without it.
 *
 * @param root Checkout root.
 * @returns The project's folder, else the kit's, else null.
 */
export function typescriptFolder(root) {
  // Worktrees lack the kit's packages; the main checkout has them.
  const kit = path.join(mainCheckout(root), KIT_FOLDER);
  return [root, kit].find((folder) => fs.existsSync(path.join(folder, "node_modules/typescript"))) ?? null;
}



/**
 * Picks the ref changes count from.
 *
 * Purpose: Work before a remote or first commit exists.
 *
 * @param config Settings of the checkout being checked.
 * @returns origin's trunk, else local trunk, else null.
 */
function defaultBase(config) {
  // A ref git cannot resolve would fail every checker.
  const trunk = config.branches.trunk;
  if (refExists(`origin/${trunk}`, config.root)) return `origin/${trunk}`;
  return refExists(trunk, config.root) ? trunk : null;
}



/**
 * Tells whether git can resolve a ref.
 *
 * Purpose: Choose a base that exists.
 *
 * @param ref Branch or remote ref.
 * @param cwd Checkout root.
 * @returns True when the ref resolves.
 */
function refExists(ref, cwd) {
  // --verify --quiet exits non-zero for unknown refs.
  return spawnSync("git", ["rev-parse", "--verify", "--quiet", ref], { cwd }).status === 0;
}



/**
 * Runs one gate step with its output shown.
 *
 * Purpose: Agents see exactly why a step failed.
 *
 * @param step Step from gateSteps.
 * @param cwd Checkout root.
 * @returns Whether it passed, and its duration.
 */
function runStep(step, cwd) {
  // A missing checker is a failure, never a skip.
  const started = Date.now();
  if (step.needs && !fs.existsSync(step.needs)) {
    console.log(`  ✗ ${step.name}: ${path.relative(cwd, step.needs)} is missing; run npm run cc -- render.`);
    return { ok: false, seconds: 0 };
  }
  console.log(`\n▶ ${step.name}`);
  const result = spawnSync(step.command, step.args, { cwd, stdio: "inherit" });
  return { ok: result.status === 0, seconds: (Date.now() - started) / 1000 };
}



/**
 * Runs the whole gate in the current checkout.
 *
 * Purpose: One command decides whether work may merge.
 *
 * @param args CLI arguments: --since <ref>, --list.
 * @returns Exit code: 0 when every step passed.
 */
export function runCheck(args) {
  // Changes count from the trunk unless told otherwise.
  const config = loadLocalConfig();
  const index = args.indexOf("--since");
  const since = index >= 0 ? args[index + 1] : defaultBase(config);
  const steps = gateSteps(config, since);
  if (args.includes("--list")) {
    for (const step of steps) console.log(`${step.name}: ${step.command} ${step.args.join(" ")}`);
    return 0;
  }
  if (!steps.length) console.log("No checks configured; add checks to command-center.json.");

  // Run every step, even after a failure, to report all.
  const results = steps.map((step) => ({ name: step.name, ...runStep(step, config.root) }));
  const failed = results.filter((result) => !result.ok).map((result) => result.name);
  const head = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: config.root, encoding: "utf8" }).stdout.trim();
  const at = new Date().toLocaleString("en-CA", { hour12: false });

  // The last line is what the Verification line quotes.
  console.log("");
  for (const result of results) console.log(`  ${result.ok ? "✓" : "✗"} ${result.name.padEnd(24)} ${result.seconds.toFixed(1)}s`);
  console.log(failed.length ? `FAIL cc check at ${at} on ${head}: ${failed.join(", ")}` : `PASS cc check at ${at} on ${head}`);
  return failed.length ? 1 : 0;
}
