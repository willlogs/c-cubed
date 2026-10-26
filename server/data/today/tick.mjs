// Ticks daily plan lines on GitHub for the Map.
// GitHub stays the record; the master hears about each tick.

import { spawnSync } from "node:child_process";
import { loadConfig } from "../../../config/load.mjs";
import { enqueue } from "../../queue/store.mjs";
import { toggleLine } from "./plan.mjs";



/**
 * Runs gh and returns its output, or throws its error.
 *
 * Purpose: Fail loudly; a silent failure would fake a tick.
 *
 * @param args Arguments after gh.
 * @param cwd Repository folder.
 * @param input Text for standard input, if any.
 * @returns Standard output.
 */
function runGh(args, cwd, input) {
  // The first line of stderr says what went wrong.
  const result = spawnSync("gh", args, { cwd, input, encoding: "utf8", maxBuffer: 20_000_000 });
  if (result.status !== 0) throw new Error((result.stderr || "gh failed").trim().split("\n")[0]);
  return result.stdout;
}



/**
 * Ticks or unticks one plan line, then tells the master.
 *
 * Purpose: Let the owner approve work from the Map.
 *
 * @param repoRoot Main checkout path.
 * @param request Plan number, line index and text, new state.
 * @returns The line's new state and whether the master heard.
 *
 * Side effects: Edits the plan; queues the master a note.
 */
export function tickPlanLine(repoRoot, { plan, index, text, checked }) {
  // Only daily plans may be edited from the page.
  const issue = JSON.parse(runGh(["issue", "view", String(Number(plan)), "--json", "body,labels"], repoRoot));
  if (!issue.labels.some((label) => label.name === "daily-plan")) throw new Error(`#${plan} is not a daily plan.`);

  // Edit the latest body, so the master's edits survive.
  const body = toggleLine(issue.body, Number(index), String(text), Boolean(checked));
  runGh(["issue", "edit", String(Number(plan)), "--body-file", "-"], repoRoot, body);

  // Approvals start work; a missing master keeps the tick.
  try {
    enqueue({ to: "master", from: "owner", text: `${loadConfig().ownerName} ${checked ? "ticked" : "unticked"} a line in plan #${plan} from the Map: ${text}` });
    return { checked: Boolean(checked), notified: true };
  } catch {
    return { checked: Boolean(checked), notified: false };
  }
}
