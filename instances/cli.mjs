#!/usr/bin/env node
// Manages agent worktrees and, when configured, their app stacks.
// Agents and the Status tab use this, not raw git.

import { spawn } from "node:child_process";
import fs from "node:fs";
import { loadConfig } from "../config/load.mjs";
import { worktreePath } from "../config/paths.mjs";
import { logPath, startStack, stopStack } from "./stacks/lifecycle.mjs";
import { runShell } from "./stacks/commands.mjs";
import { readRegistry } from "./stacks/registry.mjs";
import { printRecord, printStatus } from "./stacks/status.mjs";
import { checkoutBranch } from "./worktree/branch.mjs";
import { createWorktree, removeWorktree } from "./worktree/create.mjs";
import { checkoutPullRequest } from "./worktree/pull-request.mjs";

const USAGE = `Usage: npm run instances -- <command>
  new <name> [--base <ref>] [--up]     worktree + branch + project setup
  checkout <branch> [--up]             worktree for an existing branch
  checkout --pr <n> [--up]             pr-<n> worktree at the PR's merge result
  up <name> [--worktree <path>]        start the stack (projects with stacks)
  down <name>|all                      stop a stack, keeping its worktree
  logs <name> [-f]                     show a stack's output
  remove <name> [--force]              stop, delete the worktree and merged branch
  status                               list stacks and their state`;



/**
 * Reads one flag's value.
 *
 * Purpose: Accept values such as --base origin/main.
 *
 * @param args Remaining CLI arguments.
 * @param name Flag to find.
 * @returns Value after the flag, if present.
 */
function flag(args, name) {
  // A missing flag returns undefined.
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}



/**
 * Picks the worktree a stack runs from by default.
 *
 * Purpose: Run the named worktree from any checkout.
 *
 * @param name Stack and worktree name.
 * @returns Named worktree when present, else this folder.
 */
function defaultWorktree(name) {
  // Ad hoc names fall back to the caller's checkout.
  const named = worktreePath(name);
  return fs.existsSync(named) ? named : process.cwd();
}



/**
 * Shows a stack's output.
 *
 * Purpose: One obvious place to look when a stack fails.
 *
 * @param name Stack name.
 * @param follow Whether to keep streaming.
 * @returns Promise resolving when the output ends.
 */
function showLogs(name, follow) {
  // A project logs command wins over the kit's own file.
  const record = readRegistry().instances[name];
  if (!record) throw new Error(`No running stack ${name}. See: npm run instances -- status`);
  const { stacks } = loadConfig();
  if (stacks?.logs) return runShell(stacks.logs, record);
  return new Promise((resolve) => {
    spawn("tail", [...(follow ? ["-f"] : []), "-n", "200", logPath(name)], { stdio: "inherit" }).once("exit", resolve);
  });
}



/**
 * Runs one command from the command line.
 *
 * Purpose: Keep dispatch and exit codes in one place.
 *
 * Inputs: None.
 *
 * @returns Promise resolving when the command finishes.
 */
async function main() {
  // The first word picks the command; the next names it.
  const [command, ...args] = process.argv.slice(2);
  const name = args.find((value) => value && !value.startsWith("-"));
  if (command === "new") {
    const worktree = createWorktree(name, flag(args, "--base"));
    console.log(`Worktree ${worktree} on branch ${name}`);
    if (args.includes("--up")) printRecord(await startStack(name, worktree));
  } else if (command === "checkout") {
    // --pr wins: its worktree is always pr-<n>.
    const options = { up: args.includes("--up") };
    if (args.includes("--pr")) await checkoutPullRequest(flag(args, "--pr"), options);
    else await checkoutBranch(name, options);
  } else if (command === "up") {
    printRecord(await startStack(name, flag(args, "--worktree") ?? defaultWorktree(name)));
  } else if (command === "down") {
    // all stops every recorded stack.
    const names = name === "all" ? Object.keys(readRegistry().instances) : [name];
    for (const item of names) await stopStack(item);
  } else if (command === "remove") {
    await stopStack(name);
    const deleted = removeWorktree(name, { force: args.includes("--force") });
    console.log(deleted ? `Removed ${name} and its branch.` : `Removed ${name}; kept unmerged branch ${name}.`);
  } else if (command === "logs") {
    await showLogs(name, args.includes("-f"));
  } else if (command === "status") {
    await printStatus();
  } else {
    console.log(USAGE);
    process.exitCode = 1;
  }
}



// Print errors plainly for agents and people.
main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
