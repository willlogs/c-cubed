#!/usr/bin/env node
// Adds the command center to new or existing projects.
// Runs from a kit checkout, a vendored copy, or npx.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { installKit } from "../install/run.mjs";
import { collectAnswers, readCommandLine } from "./prompts.mjs";
import { printSummary } from "./summary.mjs";

/** The kit this script belongs to. */
const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** What each command does. */
const USAGE = `Usage: c-cubed <command> [options]
  init [dir]          add the command center to an existing git project (default: .)
  new <dir>           create a new git project with the command center
  update <dir>        install this kit into a project that already has one
  help                show this help

Options:
  --owner <name>      who makes the project's decisions (default: git user.name)
  --project <name>    project name (default: folder name)
  --trunk <branch>    branch every pull request merges into (default: detected)
  --source <url|path> --ref <ref>   where future updates come from
  --yes               accept defaults without asking
  --no-install        skip npm ci in tools/command-center`;



/**
 * Tells whether a folder is inside a git checkout.
 *
 * Purpose: init needs git; new creates it.
 *
 * @param dir Folder to test.
 * @returns True inside a checkout.
 */
function isCheckout(dir) {
  // rev-parse fails outside any repository.
  return fs.existsSync(dir) && spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd: dir, stdio: "ignore" }).status === 0;
}



/**
 * Creates an empty project folder with git.
 *
 * Purpose: Start a project the kit can then initialize.
 *
 * @param dir Folder to create; must be absent or empty.
 * @param flags Parsed flags with project and trunk.
 * @returns No value.
 *
 * Side effects: Creates the folder, a repository, and README.md.
 */
function createProject(dir, flags) {
  // Never initialize over someone's files.
  if (fs.existsSync(dir) && fs.readdirSync(dir).length) throw new Error(`${dir} exists and is not empty; use init there instead.`);
  fs.mkdirSync(dir, { recursive: true });
  const init = spawnSync("git", ["init", "--quiet", "-b", flags.trunk || "main"], { cwd: dir, encoding: "utf8" });
  if (init.status !== 0) throw new Error(`git init failed: ${init.stderr.trim()}`);
  fs.writeFileSync(path.join(dir, "README.md"), `# ${flags.project || path.basename(dir)}\n`);
}



/**
 * Runs init or new, then prints what happened.
 *
 * Purpose: Share answers, install, and next steps.
 *
 * @param dir Project folder.
 * @param flags Parsed flags.
 * @param created Whether new just created the folder.
 * @returns Promise resolving when done.
 *
 * Side effects: Installs the kit into the project.
 */
async function initialize(dir, flags, created) {
  // Ask first, then install from this kit.
  if (!isCheckout(dir)) throw new Error(`${dir} is not a git repository. Start a new project with: c-cubed new <dir>`);
  const answers = await collectAnswers(dir, flags);
  const summary = installKit({ kitRoot: KIT_ROOT, projectRoot: dir, mode: "init", answers, installPackages: !flags["no-install"], source: flags.source, ref: flags.ref });
  printSummary(summary);

  // The first start runs the setup interview.
  const steps = [...(created ? [`cd ${dir}`] : []), "npm run command-center   # first run: the setup interview writes your rules and decisions"];
  console.log(`\nNext:\n${steps.map((step) => `  ${step}`).join("\n")}`);
}



/**
 * Runs the command the user typed.
 *
 * Purpose: Route to init, new, update, or help.
 *
 * @param argv Arguments after the script path.
 * @returns Promise resolving with the exit code.
 */
async function main(argv) {
  // Folders resolve against where the user stands.
  const { command, target, flags } = readCommandLine(argv);
  const dir = target ? path.resolve(target) : process.cwd();
  if (command === "init") await initialize(dir, flags, false);
  else if (command === "new" && target) {
    createProject(dir, flags);
    await initialize(dir, flags, true);
  } else if (command === "update" && target) {
    // The project's own installer called us with this kit.
    printSummary(installKit({ kitRoot: KIT_ROOT, projectRoot: dir, mode: "update", installPackages: !flags["no-install"], source: flags.source, ref: flags.ref }));
  } else {
    console.log(USAGE);
    return command === "help" ? 0 : 1;
  }
  return 0;
}



// Errors print plainly for people and agents.
main(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
