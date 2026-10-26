// Dates and sizes the owner's decisions for the Progress tab.
// Dated by git history; sized by how far each reaches.

import { spawnSync } from "node:child_process";
import { loadConfig } from "../../../config/load.mjs";

/** Text that marks a decision changing an earlier one. */
const CHANGES = /\b(?:chang(?:es|ing)|replac(?:es|ing)|supersed(?:es|ing)|extend(?:s|ing)|retir(?:es|ing))\s+(D\d+)/i;



/**
 * Reads when each decision row was first added.
 *
 * Purpose: Later edits must not move a decision's day.
 *
 * @param repoRoot Main checkout path.
 * @returns Map of decision ID to epoch milliseconds.
 */
export function decisionDates(repoRoot) {
  // Oldest commit first; the first added row wins.
  const args = ["log", "--reverse", "--format=>>%at", "-p", "--unified=0", "--", loadConfig(repoRoot).decisions];
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8", maxBuffer: 100_000_000 });
  const dates = new Map();
  let time = 0;
  for (const line of result.status === 0 ? result.stdout.split("\n") : []) {
    if (line.startsWith(">>")) time = Number(line.slice(2)) * 1000;
    const id = /^\+\|\s*(D\d+)\s*\|/.exec(line)?.[1];
    if (id && !dates.has(id)) dates.set(id, time);
  }
  return dates;
}



/**
 * Scores how important one decision is.
 *
 * Purpose: Bigger decisions draw bigger; smaller ones smaller.
 *
 * @param reach Issues that name or are cited by it.
 * @param changes ID of a decision it changes, if any.
 * @returns Reach, plus three for changing an earlier one.
 */
export function importanceOf(reach, changes) {
  // Changing direction weighs like reaching three more issues.
  return reach + (changes ? 3 : 0);
}



/**
 * Joins Map decisions with their dates and sizes.
 *
 * Purpose: Feed the timeline's decision lane.
 *
 * @param repoRoot Main checkout path.
 * @param mapDecisions Decisions from buildMap, with linked issues.
 * @returns Dated decisions; undated rows are left out.
 */
export function datedDecisions(repoRoot, mapDecisions) {
  // Reach is the Map's own decision-to-issue links.
  const dates = decisionDates(repoRoot);
  return mapDecisions.filter((decision) => dates.get(decision.id)).map((decision) => {
    // Markdown links read as plain issue numbers.
    const changes = CHANGES.exec(`${decision.text} ${decision.consequence}`)?.[1] ?? null;
    const reach = decision.issues.length;
    const text = decision.text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
    return { id: decision.id, text, reach, changes, importance: importanceOf(reach, changes), at: dates.get(decision.id) };
  });
}
