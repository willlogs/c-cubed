// Decides where each Today item stands and its group.
// Rules only: groups.js gathers items, panel.js draws them.

import { STATUS_WORDS } from "../../cards.js";
import { issueStatus } from "../../model.js";

/** Statuses of work someone is doing right now. */
export const MOVING = ["working", "review"];

/** What an unticked plan line asks the owner, by kind. */
const UNTICKED = { decision: "your decision", task: "your task", bundle: "waiting for approval", test: "to test", other: "unticked" };

/** Section kinds whose ticked lines are finished, not approved. */
const DONE_WHEN_TICKED = ["task", "test"];



/**
 * Says where an item stands, colored like the graph.
 *
 * Purpose: Give issues, PRs, and bare lines one status scale.
 *
 * @param item Item with its issue node, PR, plan line.
 * @param sessions Live sessions.
 * @returns A graph status, or "question" for open decisions.
 */
export function statusOf(item, sessions) {
  // Ticked tasks and tests are done, whatever the issue says.
  const { node, pr, line } = item;
  if (line?.checked && DONE_WHEN_TICKED.includes(line.kind)) return "done";
  if (node) return node.kind === "question" && node.state === "OPEN" ? "question" : issueStatus(node, sessions);

  // PR-only lines follow their PR; ticked bare answers are settled.
  if (pr) return pr.state === "OPEN" ? "review" : "done";
  return line?.checked && line.kind === "decision" ? "done" : "todo";
}



/**
 * Names the answer the register already holds for a question.
 *
 * Purpose: Tell recorded but unclosed questions from open ones.
 *
 * @param node Question issue node.
 * @param decisions Register decisions with their linked issues.
 * @returns Status text for the question.
 */
function questionWord(node, decisions) {
  // A register row citing the question records its answer.
  const recorded = node?.kind === "question" ? decisions.findLast((decision) => decision.issues.includes(node.number)) : null;
  return recorded ? `recorded as ${recorded.id}` : "your decision";
}



/**
 * Says what an item needs from the owner, if anything.
 *
 * Purpose: Fill "Needs you" with every kind of ask.
 *
 * @param item Item with node, line, review and question flags.
 * @param status Status from statusOf.
 * @param decisions Register decisions, to spot recorded answers.
 * @returns Reason text, or "" when nothing is asked.
 */
export function needOf(item, status, decisions) {
  // Open asks first: a review, then a question.
  if (item.review) return "waits for your review";
  if (item.question) return questionWord(item.node, decisions);

  // Finished items need nobody; unticked lines and blocks do.
  if (status === "done") return "";
  if (item.line && !item.line.checked) return UNTICKED[item.line.kind];
  return item.node?.labels.includes("blocked") ? "blocked" : "";
}



/**
 * Picks the group an item shows in, or none.
 *
 * Purpose: Answer "what needs me, what moves, what is next".
 *
 * @param item Item with its plan line.
 * @param status Status from statusOf.
 * @param need Reason from needOf.
 * @returns "needs", "progress", "next", "done", or null to hide.
 */
export function groupOf(item, status, need) {
  // Anything the owner must act on comes first.
  if (need) return "needs";
  const { line } = item;
  if (!line) return MOVING.includes(status) ? "progress" : null;

  // Unticked lines reaching here are finished; hide them.
  if (!line.checked) return null;
  if (status === "done") return "done";
  return MOVING.includes(status) ? "progress" : "next";
}



/**
 * Writes the short status text beside an item.
 *
 * Purpose: Say only what the group heading does not.
 *
 * @param group Group the item shows in.
 * @param status Status from statusOf.
 * @param need Reason from needOf.
 * @returns Text such as "in review", or "".
 */
export function wordOf(group, status, need) {
  // the owner's reason, or the graph's word for moving work.
  if (group === "needs") return need;
  return group === "progress" ? STATUS_WORDS[status] : "";
}
