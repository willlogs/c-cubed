// Collects Today's facts: the plan and what awaits the owner.
// Statuses need live sessions, so the browser groups the items.

import { parsePlan } from "./plan.mjs";

/** Labels on issues that ask the owner to decide. */
const QUESTION_LABELS = ["decision", "needs-decision"];



/**
 * Lists the label names of an issue or pull request.
 *
 * Purpose: gh returns label objects; names are enough here.
 *
 * @param item Issue or pull request from gh.
 * @returns Label names.
 */
function labelNames(item) {
  // Missing labels count as none.
  return (item.labels ?? []).map((label) => label.name);
}



/**
 * Finds the newest open daily plan.
 *
 * Purpose: Today follows one plan, the latest one opened.
 *
 * @param issues Issues from gh issue list.
 * @returns The plan issue, or undefined without one.
 */
function newestPlan(issues) {
  // Higher issue numbers were opened later.
  return issues.filter((issue) => issue.state === "OPEN" && labelNames(issue).includes("daily-plan"))
    .sort((a, b) => b.number - a.number)[0];
}



/**
 * Lists open issues carrying any of the given labels.
 *
 * Purpose: Find questions and blocked work, newest first.
 *
 * @param issues Issues from gh issue list.
 * @param names Labels to look for.
 * @returns Issue numbers, highest first.
 */
function openLabeled(issues, names) {
  // Closed issues wait on nobody.
  return issues.filter((issue) => issue.state === "OPEN" && labelNames(issue).some((name) => names.includes(name)))
    .map((issue) => issue.number)
    .sort((a, b) => b - a);
}



/**
 * Summarizes a pull request for the Today panel.
 *
 * Purpose: Give reviews and PR-only lines a title and state.
 *
 * @param pr Pull request from gh pr list.
 * @returns Number, title, url, state, draft, review flag, closed issues.
 */
function toPr(pr) {
  // Only open, ready pull requests wait for the owner's review.
  const review = pr.state === "OPEN" && !pr.isDraft && labelNames(pr).includes("needs-human-review");
  const closes = (pr.closingIssuesReferences ?? []).map((ref) => ref.number);
  return { number: pr.number, title: pr.title, url: pr.url, state: pr.state, isDraft: Boolean(pr.isDraft), review, closes };
}



/**
 * Builds Today's data from issues and pull requests.
 *
 * Purpose: List the plan's lines and everything awaiting the owner.
 *
 * @param issues Issues from gh issue list, with bodies.
 * @param prs Pull requests from gh pr list.
 * @returns Plan, its items, open questions, blocked issues, and PRs.
 */
export function buildToday(issues, prs) {
  // Split each line's numbers into pull requests and issues.
  const plan = newestPlan(issues);
  const prByNumber = new Map(prs.map((pr) => [pr.number, toPr(pr)]));
  const items = parsePlan(plan?.body).map(({ numbers, ...item }) => ({
    ...item,
    issues: numbers.filter((number) => !prByNumber.has(number)),
    prs: numbers.filter((number) => prByNumber.has(number)),
  }));

  // Questions, blocked work, and reviews need the owner regardless.
  const named = new Set(items.flatMap((item) => item.prs));
  return {
    plan: plan ? { number: plan.number, title: plan.title, url: plan.url } : null,
    items,
    questions: openLabeled(issues, QUESTION_LABELS),
    blocked: openLabeled(issues, ["blocked"]),
    prs: [...prByNumber.values()].filter((pr) => pr.review || named.has(pr.number)),
  };
}
