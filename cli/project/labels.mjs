// Creates the GitHub labels the skills and page rely on.
// Safe to rerun: existing labels get the kit's colors.

import { spawnSync } from "node:child_process";
import { mainCheckout } from "../../config/paths.mjs";

/** Every label the kit reads or writes: name, color, description. */
export const KIT_LABELS = [
  ["idea", "c5def5", "An idea from the owner, not yet a task"],
  ["decision", "d93f0b", "A question only the owner decides"],
  ["daily-plan", "0e8a16", "The command center's plan for one day"],
  ["needs-decision", "fbca04", "Work blocked on the owner's answer"],
  ["needs-human-review", "b60205", "A pull request the owner reviews"],
  ["P0", "b60205", "Today, ahead of the plan"],
  ["type:feature", "1d76db", "New behavior; ends in a pull request"],
  ["type:bug", "d73a4a", "Broken behavior; ends in a pull request"],
  ["type:chore", "cfd3d7", "Upkeep; ends in a pull request"],
  ["type:research", "5319e7", "A report only; no code changes"],
  ["type:ops", "006b75", "Changes to running services"],
  ["risk:schema", "e99695", "Changes a data schema; one at a time"],
  ["risk:contracts", "e99695", "Changes a shared contract; one at a time"],
];



/**
 * Creates or updates every kit label on GitHub.
 *
 * Purpose: Setup and updates make the labels exist.
 *
 * Inputs: None.
 *
 * @returns Exit code: 0 when every label was written.
 *
 * Side effects: Writes labels to the GitHub repository.
 */
export function createLabels() {
  // --force updates color and text of existing labels.
  const cwd = mainCheckout();
  let failures = 0;
  for (const [name, color, description] of KIT_LABELS) {
    const result = spawnSync("gh", ["label", "create", name, "--color", color, "--description", description, "--force"], { cwd, encoding: "utf8" });
    console.log(`${result.status === 0 ? "✓" : "✗"} ${name}${result.status === 0 ? "" : `: ${result.stderr.trim()}`}`);
    if (result.status !== 0) failures += 1;
  }
  return failures ? 1 : 0;
}
