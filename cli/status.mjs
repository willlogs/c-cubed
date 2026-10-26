#!/usr/bin/env node
// Prints stacks, versions, today's plan, and open PRs together.
// Gives the owner and the command center the same picture.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { stateDir } from "../config/paths.mjs";
import { printStatus } from "../instances/stacks/status.mjs";
import { checkoutRoot } from "../versions/github/gh.mjs";
import { listVersions } from "../versions/list.mjs";

/** Usage snapshot written by the status line script. */
const USAGE_FILE = path.join(stateDir(), "usage.json");



/**
 * Runs a gh command and parses its JSON output.
 *
 * Purpose: Read GitHub state without extra dependencies.
 *
 * @param args Arguments after gh.
 * @returns Parsed JSON, or undefined when gh fails.
 */
function gh(args) {
  // Missing auth or network should degrade, not crash.
  const result = spawnSync("gh", args, { encoding: "utf8" });
  if (result.status !== 0) return undefined;
  return JSON.parse(result.stdout || "null");
}



/**
 * Summarizes a pull request's checks in one word.
 *
 * Purpose: Show CI health at a glance.
 *
 * @param checks Status check rollup from gh.
 * @returns failing, running, passing, or none.
 */
function ciState(checks = []) {
  // Any failure wins, then anything unfinished.
  const states = checks.map((check) => check.conclusion || check.state || check.status);
  if (states.some((state) => ["FAILURE", "ERROR", "CANCELLED", "TIMED_OUT"].includes(state))) return "failing";
  if (states.some((state) => ["PENDING", "QUEUED", "IN_PROGRESS", "EXPECTED"].includes(state))) return "running";
  return states.length ? "passing" : "none";
}



/**
 * Prints the current version and each open one.
 *
 * Purpose: Show what is live and what ships next.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
function printVersions() {
  // GitHub trouble degrades to one line.
  try {
    const views = listVersions(checkoutRoot(), true);
    console.log(`\nCurrent version: ${views.current}`);
    for (const version of views.open) console.log(`  ${version.title} [${version.stageLabel}] ${version.next}`);
  } catch (error) {
    console.log(`\nVersion: unknown (${error.message})`);
  }
}



/**
 * Prints the GitHub half of the status view.
 *
 * Purpose: Show plan, pull requests, and waiting decisions.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
function printGitHub() {
  // Today's plan, then queues waiting on the owner.
  const plan = gh(["issue", "list", "--label", "daily-plan", "--state", "open", "--limit", "1", "--json", "number,title,url"])?.[0];
  console.log(`\nDaily plan: ${plan ? `#${plan.number} ${plan.title} ${plan.url}` : "none open"}`);
  for (const label of ["decision", "idea", "needs-human-review"]) {
    const items = gh(["issue", "list", "--label", label, "--state", "open", "--json", "number"]) ?? [];
    console.log(`Open ${label}: ${items.length}`);
  }

  // Each open pull request with its CI state.
  const prs = gh(["pr", "list", "--state", "open", "--json", "number,title,headRefName,labels,statusCheckRollup"]) ?? [];
  console.log(`Open pull requests: ${prs.length}`);
  for (const pr of prs) {
    const review = pr.labels.some((label) => label.name === "needs-human-review") ? " [needs the owner]" : "";
    console.log(`  #${pr.number} ${pr.headRefName}  CI ${ciState(pr.statusCheckRollup)}${review}  ${pr.title}`);
  }
}



/**
 * Prints stacks, GitHub state, and plan usage.
 *
 * Purpose: Answer "where is everything?" in one command.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
async function main() {
  // Local stacks, versions, GitHub, then usage.
  await printStatus();
  printVersions();
  printGitHub();
  const usage = fs.existsSync(USAGE_FILE) ? JSON.parse(fs.readFileSync(USAGE_FILE, "utf8")) : undefined;
  const five = usage?.five_hour?.used_percentage;
  console.log(`\nPlan usage: ${usage ? `5h ${Math.round(five ?? 0)}%, 7d ${Math.round(usage.seven_day?.used_percentage ?? 0)}% (as of ${usage.at})` : "unknown until a session reports it"}`);
}



// Print the combined view once.
await main();
