// Records the local verify result on GitHub: status and comment.
// Comments give each PR a dated history of runs.

import { spawnSync } from "node:child_process";
import { mainCheckout } from "../../config/paths.mjs";

/** Status name shown beside the pull request's checks. */
export const STATUS_CONTEXT = "local verify";

/** GitHub rejects longer status descriptions. */
const MAX_DESCRIPTION = 140;

/** Local date and time, such as "2026-10-23, 18:58 EDT". */
const STAMP = new Intl.DateTimeFormat("en-CA", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZoneName: "short",
});



/**
 * Sets the local verify status on a commit.
 *
 * Purpose: Record the gate where GitHub shows PR checks.
 *
 * A failed post only warns: the printed verdict stays authoritative.
 *
 * Side effects: Calls the GitHub statuses API through gh.
 *
 * @param sha Pull request head commit.
 * @param state "pending", "success", or "failure".
 * @param description One-line summary, such as "PASS in 41.5s".
 * @returns No value.
 */
export function setCommitStatus(sha, state, description) {
  // gh fills {owner}/{repo} from the main checkout's remote.
  const args = [
    "api", "--method", "POST", "--silent", `repos/{owner}/{repo}/statuses/${sha}`,
    "-f", `state=${state}`, "-f", `context=${STATUS_CONTEXT}`,
    "-f", `description=${description.slice(0, MAX_DESCRIPTION)}`,
  ];
  const result = spawnSync("gh", args, { cwd: mainCheckout(), encoding: "utf8" });

  // Warn without failing, so verification still reports.
  if (result.status !== 0) console.log(`  ! GitHub status not set: ${(result.stderr || "").trim()}`);
}



/**
 * Shortens a commit SHA for display.
 *
 * Purpose: Keep report lines short and readable.
 *
 * @param sha Full commit SHA.
 * @returns First seven characters.
 */
export function short(sha) {
  // Seven characters match git's default abbreviation.
  return sha.slice(0, 7);
}



/**
 * Records a finished run as status and comment.
 *
 * Purpose: Say on the PR when verification ran and how.
 *
 * Side effects: Sets a status; comments on the PR.
 *
 * @param pr Pull request number.
 * @param target Verified head and base commits.
 * @param total Run duration, such as "41.5s".
 * @param failed Names of failed steps; empty on pass.
 * @returns No value.
 */
export function recordVerdict(pr, target, total, failed) {
  // The status feeds checks; the comment keeps the history.
  const ok = failed.length === 0;
  const base = `${target.base} ${short(target.baseSha)}`;
  setCommitStatus(target.head, ok ? "success" : "failure", ok ? `PASS in ${total}, merged with ${base}` : `FAIL in ${total}: ${failed.join(", ")}`);
  const result = ok ? `Every \`cc check\` step passed in ${total}.` : `Failed: ${failed.join(", ")} (${total}).`;
  const body = `**Local verify: ${ok ? "PASS" : "FAIL"}** · ${STAMP.format(new Date())}\n\n`
    + `Head \`${short(target.head)}\` merged with \`${target.base}\` \`${short(target.baseSha)}\`. ${result}`;
  const comment = spawnSync("gh", ["pr", "comment", String(pr), "--body", body], { cwd: mainCheckout(), encoding: "utf8" });

  // Warn without failing; the printed verdict stays authoritative.
  if (comment.status !== 0) console.log(`  ! PR comment not posted: ${(comment.stderr || "").trim()}`);
}
