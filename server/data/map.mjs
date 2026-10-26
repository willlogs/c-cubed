// Builds the Map's decision and work graph from GitHub.
// Links come from issue text, so nobody keeps extra bookkeeping.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { loadConfig } from "../../config/load.mjs";
import { captures, decidedQuote } from "./issue-text.mjs";
import { buildToday } from "./today/build.mjs";

/** Rebuild at most once a minute; GitHub calls are slow. */
const CACHE_MS = 60_000;

/** Last built map and when it was built. */
let cache = { at: 0, map: null };



/**
 * Runs gh and parses its JSON output.
 *
 * Purpose: Read GitHub without extra dependencies.
 *
 * @param args Arguments after gh.
 * @param cwd Repository folder.
 * @returns Parsed JSON, or an empty list on failure.
 */
function gh(args, cwd) {
  // A missing login degrades the map instead of crashing.
  const result = spawnSync("gh", args, { cwd, encoding: "utf8", maxBuffer: 20_000_000 });
  return result.status === 0 ? JSON.parse(result.stdout || "[]") : [];
}



/**
 * Reads accepted decisions from the Decision Register.
 *
 * Purpose: Use the owner's recorded decisions as graph roots.
 *
 * @param repoRoot Main checkout path.
 * @returns Decisions with id, text, consequence, and cited issues.
 */
function readDecisions(repoRoot) {
  // The register's path comes from command-center.json.
  const file = path.join(repoRoot, loadConfig(repoRoot).decisions);
  const rows = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n") : [];
  return rows.flatMap((row) => parseDecisionRow(row) ?? []);
}



/**
 * Parses one accepted-decision table row.
 *
 * Purpose: Accept rows with or without an Enforced by column.
 *
 * @param row One line of the register.
 * @returns Decision with id, text, consequence, enforcement, cites; or null.
 */
export function parseDecisionRow(row) {
  // Rows look like "| D16 | decision | consequence | enforced by |".
  const match = /^\|\s*(D\d+)\s*\|(.*)\|\s*$/.exec(row);
  if (!match) return null;
  const [text = "", consequence = "", enforcedBy = ""] = match[2].split("|").map((cell) => cell.trim());
  if (!text) return null;

  // Rows cite issues as #14 or as issue URLs.
  return { id: match[1], text, consequence, enforcedBy, cites: captures(row, /(?:issues\/|#)(\d+)/g).map(Number) };
}



/**
 * Turns one GitHub issue into a graph node.
 *
 * Purpose: Read relationships, decisions, mentions, and the owner's words.
 *
 * @param issue Issue from gh issue list.
 * @returns Node with links but no pull requests yet.
 */
function toNode(issue) {
  // Labels mark work, questions, and daily plans.
  const labels = issue.labels.map((label) => label.name);
  const body = issue.body ?? "";
  const kind = labels.includes("daily-plan") ? "plan" : labels.includes("decision") ? "question" : "work";

  // GitHub relationships; "Part of #9" only for old closed issues.
  const partOf = issue.state === "CLOSED" ? Number(/^\s*Part of #(\d+)/im.exec(body)?.[1]) || null : null;
  return {
    number: issue.number, title: issue.title, state: issue.state, url: issue.url, closedAt: issue.closedAt, labels, kind,
    parent: issue.parent?.number ?? partOf,
    blockedBy: (issue.blockedBy?.nodes ?? []).filter((blocker) => blocker.state === "OPEN").map((blocker) => blocker.number),
    decisions: kind === "work" ? captures(body, /\b(D\d{2,})\b/g) : [],
    mentions: kind === "plan" ? [] : captures(body, /#(\d+)/g).map(Number).filter((number) => number !== issue.number),
    // Today shows the owner's quote as the reason.
    decidedBy: issue.state === "OPEN" ? decidedQuote(body) : "",
    prs: [], children: [],
  };
}



/**
 * Tells whether an issue belongs on the Map.
 *
 * Purpose: Keep dropped and folded issues from counting as done.
 *
 * @param issue Issue from gh issue list.
 * @returns False for issues closed as not planned or duplicate.
 */
function countsAsWork(issue) {
  // Only the close reason separates shipped from dropped.
  return !["NOT_PLANNED", "DUPLICATE"].includes(issue.stateReason);
}



/**
 * Builds the graph data, cached for a minute.
 *
 * Purpose: Feed the Map view one consistent structure.
 *
 * @param repoRoot Main checkout path.
 * @param fresh Whether to skip the cache.
 * @returns Decisions, issue nodes with their links, and Today.
 */
export function buildMap(repoRoot, fresh = false) {
  // Serve the cache while it is fresh.
  if (!fresh && cache.map && Date.now() - cache.at < CACHE_MS) return cache.map;
  const fields = "number,title,state,stateReason,body,labels,parent,blockedBy,url,closedAt";
  const issues = gh(["issue", "list", "--state", "all", "--limit", "400", "--json", fields], repoRoot).filter(countsAsWork);
  const prFields = "number,title,state,isDraft,labels,url,closingIssuesReferences";
  const prs = gh(["pr", "list", "--state", "all", "--limit", "300", "--json", prFields], repoRoot);

  // Attach pull requests, then children to known parents.
  const nodes = new Map(issues.map((issue) => [issue.number, toNode(issue)]));
  for (const pr of prs) {
    for (const ref of pr.closingIssuesReferences ?? []) nodes.get(ref.number)?.prs.push({ number: pr.number, state: pr.state, url: pr.url });
  }
  for (const node of [...nodes.values()].sort((a, b) => a.number - b.number)) {
    // A parent outside the list leaves the node top-level.
    if (nodes.has(node.parent)) nodes.get(node.parent).children.push(node.number);
    else node.parent = null;
  }

  // Decisions link to issues naming them, plus cited issues.
  const decisions = readDecisions(repoRoot).map(({ cites, ...decision }) => ({
    ...decision,
    issues: [...nodes.values()].filter((node) => node.decisions.includes(decision.id) || cites.includes(node.number)).map((node) => node.number),
  }));
  const today = buildToday(issues, prs);
  cache = { at: Date.now(), map: { builtAt: new Date().toISOString(), decisions, issues: [...nodes.values()], today } };
  return cache.map;
}
