// Builds the Today panel's groups from the server's Today data.
// Merges plan lines with the owner's other asks, per issue.

import { issueStatus } from "../../model.js";
import { groupOf, MOVING, needOf, statusOf, wordOf } from "./status.js";
import { graphKey, whyOf } from "./why.js";

/** Groups in screen order; "needs" awaits the owner. */
export const GROUPS = ["needs", "progress", "next", "done"];

/** Today data from a server that predates the panel. */
const NO_TODAY = { plan: null, items: [], questions: [], blocked: [], prs: [] };



/**
 * Returns the item for a key, adding it when new.
 *
 * Purpose: Merge every source for one issue into one item.
 *
 * @param list Items so far, with a byKey index.
 * @param key "i:12" for issues, "p:44" for PRs.
 * @param fields Fields for a new item.
 * @returns The existing or new item.
 */
function upsert(list, key, fields) {
  // The first item for a key absorbs later sources.
  if (!list.byKey.has(key)) {
    const item = { id: `t:${key}`, line: null, number: null, pr: null, ...fields };
    list.byKey.set(key, item);
    list.items.push(item);
  }
  return list.byKey.get(key);
}



/**
 * Adds one item per plan line, in the plan's order.
 *
 * Purpose: Each line is the plan's word on its item.
 *
 * @param list Items so far, with a byKey index.
 * @param today Server Today data.
 * @returns No value.
 */
function addPlanLines(list, today) {
  // A line is about its first issue, else first PR.
  const prs = new Map(today.prs.map((pr) => [pr.number, pr]));
  today.items.forEach((line, index) => {
    const number = line.issues[0] ?? null;
    const pr = number ? null : prs.get(line.prs[0]) ?? null;
    const key = number ? `i:${number}` : pr ? `p:${pr.number}` : `l:${index}`;

    // A repeated issue gets its own item, keyed by line.
    if (list.byKey.has(key)) list.items.push({ id: `t:${key}:${index}`, line, number, pr });
    else upsert(list, key, { line, number, pr });
  });
}



/**
 * Adds questions, reviews, blocked work, and moving work.
 *
 * Purpose: Show the owner's asks even without plan lines.
 *
 * @param list Items so far, with a byKey index.
 * @param today Server Today data.
 * @param nodes Issue nodes by number.
 * @param sessions Live sessions.
 * @returns No value.
 */
function addAsks(list, today, nodes, sessions) {
  // Questions and blocked issues join their plan line, if any.
  for (const number of today.questions) upsert(list, `i:${number}`, { number }).question = true;
  for (const number of today.blocked) upsert(list, `i:${number}`, { number });

  // A review joins the issue it closes, else stands alone.
  for (const pr of today.prs.filter((candidate) => candidate.review)) {
    const number = pr.closes.find((closed) => nodes.has(closed));
    upsert(list, number ? `i:${number}` : `p:${pr.number}`, number ? { number } : { pr }).review = pr;
  }

  // With a plan, moving work shows even when unplanned.
  if (!today.plan) return;
  for (const node of nodes.values()) {
    if (node.kind === "work" && MOVING.includes(issueStatus(node, sessions))) upsert(list, `i:${node.number}`, { number: node.number });
  }
}



/**
 * Fills in what the panel draws for one item.
 *
 * Purpose: Give each item title, link, status, group, and why.
 *
 * @param item Collected item.
 * @param map Server map payload.
 * @param context Nodes, sessions, and the plan's link.
 * @returns Drawable item; group is null when hidden.
 */
function finish(item, map, context) {
  // Status, then the owner's part, then where it shows.
  const node = context.nodes.get(item.number) ?? null;
  const full = { ...item, node };
  const status = statusOf(full, context.sessions);
  const need = needOf(full, status, map.decisions);
  const group = groupOf(full, status, need);

  // Issues and PRs give titles; bare lines show their note.
  const issueUrl = item.number && context.plan ? context.plan.url.replace(/\d+$/, item.number) : "";
  return {
    ...full, status, group, word: wordOf(group, status, need),
    title: node?.title ?? item.pr?.title ?? item.line?.note ?? "",
    url: node?.url ?? item.pr?.url ?? (issueUrl || context.plan?.url || ""),
    label: item.number ? `#${item.number}` : item.pr ? `PR #${item.pr.number}` : "",
    key: graphKey(node, context.nodes),
    // PR-only items are their PR, so need no tag.
    openPr: item.pr ? null : item.review ?? node?.prs.find((pr) => pr.state === "OPEN") ?? null,
    why: whyOf(full, map.decisions, context.nodes),
  };
}



/**
 * Builds the Today panel's plan link and groups.
 *
 * Purpose: Answer what needs the owner, what moves, and why.
 *
 * @param map Server map payload with its today field.
 * @param sessions Live sessions, for work in progress.
 * @returns Plan, or null, and groups of drawable items.
 */
export function buildToday(map, sessions) {
  // Plan lines first, then the owner's other asks.
  const today = map.today ?? NO_TODAY;
  const nodes = new Map(map.issues.map((node) => [node.number, node]));
  const list = { items: [], byKey: new Map() };
  addPlanLines(list, today);
  addAsks(list, today, nodes, sessions);

  // Without a plan, only "Needs you" shows.
  const context = { nodes, sessions, plan: today.plan };
  const items = list.items.map((item) => finish(item, map, context)).filter((item) => item.group);
  const names = today.plan ? GROUPS : ["needs"];
  return { plan: today.plan, groups: names.map((name) => ({ name, items: items.filter((item) => item.group === name) })) };
}
