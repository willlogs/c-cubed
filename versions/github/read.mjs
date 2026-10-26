// Reads version milestones, their issues, and their release PRs.
// GitHub is the record; nothing else stores a version's state.

import { loadConfig } from "../../config/load.mjs";
import { captures } from "../../server/data/issue-text.mjs";
import { parseTitle } from "../model/number.mjs";
import { ghJson } from "./gh.mjs";

/** Issue fields every version view needs. */
const ISSUE_FIELDS = "number,title,state,stateReason,labels,milestone,url,body";

/** PR fields for release steps and changelog links. */
const PR_FIELDS = "number,title,state,url,baseRefName,headRefName,mergeCommit,closingIssuesReferences,labels";



/**
 * Names the branch of a version's release PR.
 *
 * Purpose: Find and create release PRs the same way.
 *
 * @param number Version number.
 * @returns Branch name, such as "release-v2.1.0".
 */
export function releaseBranch(number) {
  // One release branch per version.
  return `release-v${number}`;
}



/**
 * Names the frozen branch a version's promotion ships.
 *
 * Purpose: Promote exactly the release commit, nothing newer.
 *
 * @param number Version number.
 * @returns Branch name, such as "ship-v2.1.0".
 */
export function shipBranch(number) {
  // Later trunk merges never reach this branch.
  return `ship-v${number}`;
}



/**
 * Reads milestones, issues, and PRs from GitHub.
 *
 * Purpose: One read that every version view shares.
 *
 * @param repoRoot Main checkout path.
 * @returns Raw milestones, issues, and pull requests.
 */
export function readGitHub(repoRoot) {
  // Dropped and duplicate issues never count.
  const milestones = ghJson(["api", "repos/{owner}/{repo}/milestones?state=all&per_page=100"], repoRoot);
  const issues = ghJson(["issue", "list", "--state", "all", "--limit", "500", "--json", ISSUE_FIELDS], repoRoot)
    .filter((issue) => !["NOT_PLANNED", "DUPLICATE"].includes(issue.stateReason));
  const prs = ghJson(["pr", "list", "--state", "all", "--limit", "300", "--json", PR_FIELDS], repoRoot);
  return { milestones, issues, prs, branches: loadConfig(repoRoot).branches };
}



/**
 * Finds a version's live release PR on one branch.
 *
 * Purpose: Ignore PRs closed without merging.
 *
 * @param prs Every pull request.
 * @param head Head branch name.
 * @param base Base branch name.
 * @returns Number, url, state, and merge commit, or null.
 */
function findPr(prs, head, base) {
  // The newest open or merged one wins.
  const pr = prs.filter((item) => item.headRefName === head && item.baseRefName === base && item.state !== "CLOSED")
    .sort((a, b) => b.number - a.number)[0];
  return pr ? { number: pr.number, url: pr.url, state: pr.state, mergeCommit: pr.mergeCommit?.oid ?? null } : null;
}



/**
 * Turns GitHub data into versions.
 *
 * Purpose: Keep only milestones titled like versions.
 *
 * @param data Milestones, issues, and PRs from readGitHub.
 * @returns Versions with their issues and release PRs.
 */
export function toVersions({ milestones, issues, prs, branches = { trunk: "main", production: null } }) {
  // Issues carry label names, merged PRs, and decision IDs.
  const linked = issues.map((issue) => ({
    ...issue, labels: issue.labels.map((label) => label.name),
    decisions: captures(issue.body ?? "", /\b(D\d{2,})\b/g),
    prs: prs.filter((pr) => pr.closingIssuesReferences?.some((ref) => ref.number === issue.number)),
  }));

  // Each version milestone with its issues and PRs.
  return milestones.flatMap((milestone) => {
    // Other milestones stay out of the views.
    const parsed = parseTitle(milestone.title);
    if (!parsed) return [];
    return [{
      milestone: milestone.number, title: milestone.title, ...parsed, about: milestone.description ?? "",
      open: milestone.state === "open", url: milestone.html_url, closedAt: milestone.closed_at,
      issues: linked.filter((issue) => issue.milestone?.number === milestone.number),
      release: findPr(prs, releaseBranch(parsed.number), branches.trunk),
      promotes: Boolean(branches.production),
      promotion: branches.production ? findPr(prs, shipBranch(parsed.number), branches.production) : null,
    }];
  });
}
