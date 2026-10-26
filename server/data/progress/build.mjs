// Builds the Progress tab's data from GitHub and the register.
// Cached for two minutes; the Refresh button skips the cache.

import { ghJson } from "../../../versions/github/gh.mjs";
import { buildMap } from "../map.mjs";
import { buildDays, dayKey, runStart } from "./days.mjs";
import { datedDecisions } from "./decisions.mjs";
import { columns, heatmap, totals } from "./grid.mjs";

/** History changes slowly; two minutes keeps tabs quick. */
const CACHE_MS = 120_000;

/** Last built payload and when it was built. */
let cache = { at: 0, value: null };



/**
 * Reads every issue and merged PR with dates.
 *
 * Purpose: The raw events behind each day.
 *
 * @param repoRoot Main checkout path.
 * @returns Issues and merged PRs.
 */
function readHistory(repoRoot) {
  // Dropped issues stay, flagged, so lists stay honest.
  const issueFields = "number,title,state,stateReason,labels,url,createdAt,closedAt";
  const issues = ghJson(["issue", "list", "--state", "all", "--limit", "1000", "--json", issueFields], repoRoot).map((issue) => ({
    ...issue, labels: issue.labels.map((label) => label.name), dropped: ["NOT_PLANNED", "DUPLICATE"].includes(issue.stateReason),
  }));

  // PRs name the issues they close.
  const prFields = "number,title,url,mergedAt,additions,deletions,labels,closingIssuesReferences";
  const prs = ghJson(["pr", "list", "--state", "merged", "--limit", "1000", "--json", prFields], repoRoot).map((pr) => ({
    ...pr, labels: pr.labels.map((label) => label.name), closes: (pr.closingIssuesReferences ?? []).map((ref) => ref.number),
  }));

  return { issues, prs };
}



/**
 * Builds the heatmap, day columns, and totals.
 *
 * Purpose: Answer the Progress tab in one payload.
 *
 * @param repoRoot Main checkout path.
 * @param fresh Whether to skip the cache.
 * @returns Today, run start, heatmap, columns, totals.
 */
export function buildProgress(repoRoot, fresh = false) {
  // Serve the cache while it is fresh.
  if (!fresh && cache.value && Date.now() - cache.at < CACHE_MS) return cache.value;
  const today = dayKey(Date.now());
  const days = buildDays({ ...readHistory(repoRoot), decisions: datedDecisions(repoRoot, buildMap(repoRoot, fresh).decisions) });
  const start = runStart(days, today);
  const value = {
    builtAt: new Date().toISOString(), today, start,
    heatmap: heatmap(days, start, today), columns: columns(days, start, today), totals: totals(days, start, today),
  };
  cache = { at: Date.now(), value };
  return value;
}
