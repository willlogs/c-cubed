// Gathers why each Today item exists, and its graph node.
// Sources: register decisions, parent and mentioned issues, plan, quote.

import { decisionNumber, topOf } from "../../model.js";



/**
 * Finds the graph node an issue lights when hovered.
 *
 * Purpose: Reuse the graph's keys; children light their goal.
 *
 * @param node Issue node, or null.
 * @param nodes Issue nodes by number.
 * @returns Key such as "i:9" or "q:34", else "".
 */
export function graphKey(node, nodes) {
  // Questions have a column; work climbs to its top card.
  if (!node) return "";
  return node.kind === "question" ? `q:${node.number}` : `i:${topOf(nodes, node.number)}`;
}



/**
 * Lists the register decisions behind an item.
 *
 * Purpose: Match the graph's lines, plus ids the plan names.
 *
 * @param item Today item with its node and plan line.
 * @param decisions Register decisions with their linked issues.
 * @returns Decisions, newest first.
 */
function decisionsOf(item, decisions) {
  // As in the graph: issues naming or cited by decisions.
  const named = new Set(item.line?.decisions ?? []);
  return decisions
    .filter((decision) => named.has(decision.id) || (item.node && decision.issues.includes(item.node.number)))
    .sort((a, b) => decisionNumber(b) - decisionNumber(a));
}



/**
 * Shapes an issue node for a reason row.
 *
 * Purpose: Carry the link and the graph key together.
 *
 * @param node Issue node.
 * @param nodes Issue nodes by number.
 * @returns Number, title, url, and graph key.
 */
function issueRef(node, nodes) {
  // Only what a reason row draws.
  return { number: node.number, title: node.title, url: node.url, key: graphKey(node, nodes) };
}



/**
 * Lists the issues an item belongs to or mentions.
 *
 * Purpose: Show related work without opening GitHub.
 *
 * @param item Today item with its node and plan line.
 * @param nodes Issue nodes by number.
 * @returns Parent reference or null, blockers, and mentioned references.
 */
function relatedOf(item, nodes) {
  // The body's mentions, plus other issues on the plan line.
  const parent = nodes.get(item.node?.parent) ?? null;
  const numbers = new Set([...(item.node?.mentions ?? []), ...(item.line?.issues.slice(1) ?? [])]);

  // Parent and blockers show apart; skip plans and the item.
  const blockers = (item.node?.blockedBy ?? []).map((number) => nodes.get(number)).filter(Boolean);
  const mentions = [...numbers].map((number) => nodes.get(number))
    .filter((node) => node && node.kind !== "plan" && node !== parent && node !== item.node && !blockers.includes(node));
  return { parent: parent && issueRef(parent, nodes), blockedBy: blockers.map((node) => issueRef(node, nodes)), mentions: mentions.map((node) => issueRef(node, nodes)) };
}



/**
 * Gathers everything that explains an item.
 *
 * Purpose: One shape for the folded line and open detail.
 *
 * @param item Today item with node, PR, and plan line.
 * @param decisions Register decisions with their linked issues.
 * @param nodes Issue nodes by number.
 * @returns Decisions, parent, blockers, mentions, plan note, and quote.
 */
export function whyOf(item, decisions, nodes) {
  // Any part may be empty; the panel skips empty parts.
  return {
    decisions: decisionsOf(item, decisions),
    ...relatedOf(item, nodes),
    section: item.line?.section ?? "",
    note: item.line?.note ?? "",
    quote: item.node?.decidedBy ?? "",
  };
}
