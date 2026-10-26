// Turns the server's map into what the Map view draws.
// Decides status, labels, visibility, and connecting lines.

/** Work statuses, most urgent first; sorting follows this order. */
export const STATUSES = ["working", "review", "todo", "blocked", "done"];

/** Longest decision label before it is cut. */
const LABEL_LIMIT = 46;



/**
 * Says where one issue stands right now.
 *
 * Purpose: Color every dot and segment the same way.
 *
 * @param node Issue node from the server.
 * @param sessions Live command-center sessions.
 * @returns One of STATUSES.
 */
export function issueStatus(node, sessions) {
  // Closed, live worker, PR, then blockers or the label.
  if (node.state === "CLOSED") return "done";
  if (sessions.some((session) => session.alive && session.meta?.issue === node.number)) return "working";
  if (node.prs.some((pr) => pr.state === "OPEN")) return "review";
  return node.blockedBy?.length || node.labels.includes("blocked") ? "blocked" : "todo";
}



/**
 * Turns register markdown into plain text.
 *
 * Purpose: Show decisions without link or code syntax.
 *
 * @param text Markdown cell text.
 * @returns Plain text, not yet HTML-escaped.
 */
export function plainText(text) {
  // Keep link labels and drop code ticks.
  return String(text).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`/g, "");
}



/**
 * Shortens a register decision to a node label.
 *
 * Purpose: Keep the graph readable; clicking shows the rest.
 *
 * @param text Decision cell text in markdown.
 * @returns Plain label of a few words.
 */
export function shortDecision(text) {
  // Cut at the first clause, then at a word.
  const clause = plainText(text).split(/[:;]|\s\(/)[0].trim();
  if (clause.length <= LABEL_LIMIT) return clause;
  return `${clause.slice(0, LABEL_LIMIT).replace(/\s+\S*$/, "")}…`;
}



/**
 * Drops a "Staging 1/3:" prefix under its parent.
 *
 * Purpose: Avoid repeating the parent's name on every child.
 *
 * @param title Child issue title.
 * @returns Title without the series prefix, capitalized.
 */
export function childTitle(title) {
  // Only strip prefixes that end in a part count.
  const rest = title.replace(/^[^:]*\b\d+\/\d+:\s*/, "");
  return /^[a-z]+\s/.test(rest) ? rest.charAt(0).toUpperCase() + rest.slice(1) : rest;
}



/**
 * Finds the top-level issue a node sits under.
 *
 * Purpose: Point lines at the card that is drawn.
 *
 * @param byNumber Issue nodes by number.
 * @param number Issue number.
 * @returns Number of its top-level ancestor.
 */
export function topOf(byNumber, number) {
  // Climb parents until none is left.
  const parent = byNumber.get(number)?.parent;
  return parent ? topOf(byNumber, parent) : number;
}



/**
 * Builds one work card with its parts and progress.
 *
 * Purpose: Give goals one lead status and a done count.
 *
 * @param node Open top-level work issue.
 * @param byNumber Issue nodes by number.
 * @param sessions Live sessions.
 * @returns Card with status, lead status, children, and done count.
 */
function toCard(node, byNumber, sessions) {
  // A goal's lead status is its most urgent open part.
  const children = node.children.map((number) => byNumber.get(number)).map((child) => ({ ...child, status: issueStatus(child, sessions) }));
  const open = children.filter((child) => child.status !== "done");
  const status = issueStatus(node, sessions);
  const lead = open.length ? STATUSES.find((candidate) => open.some((child) => child.status === candidate)) : status;
  return { ...node, status, children, lead, done: children.length - open.length };
}



/**
 * Collects lines from questions and decisions to drawn cards.
 *
 * Purpose: Connect each reason to the work it shapes.
 *
 * @param sources Questions and decisions with key and issue numbers.
 * @param byNumber Issue nodes by number.
 * @param drawn Numbers of drawn top-level cards.
 * @param open Numbers of drawn open-work cards.
 * @returns Lines with from, to, exact, kind, folded.
 */
function collectEdges(sources, byNumber, drawn, open) {
  // Lines end on the drawn card; exact names the part.
  return sources.flatMap((source) => source.numbers
    .filter((number) => drawn.has(topOf(byNumber, number)))
    .map((number) => ({
      from: source.key, to: `i:${topOf(byNumber, number)}`, exact: number, kind: source.kind,
      // A line is grayed when either end is folded history.
      folded: Boolean(source.folded) || !open.has(topOf(byNumber, number)),
    })));
}



/**
 * Reads the number out of a decision id.
 *
 * Purpose: Sort decisions newest first.
 *
 * @param decision Register decision with an id such as "D25".
 * @returns The decision's number.
 */
export function decisionNumber(decision) {
  // Ids are a letter followed by digits.
  return Number(decision.id.slice(1));
}



/**
 * Builds everything the Map view draws.
 *
 * Purpose: Keep layout decisions out of the HTML code.
 *
 * @param map Server map: decisions and issue nodes.
 * @param sessions Live sessions, for in-progress work.
 * @param unfolded Whether folded history is shown.
 * @returns Questions, decisions, open and folded cards, edges, counts.
 */
export function buildView(map, sessions, unfolded) {
  // Open top-level work first, newest issue first.
  const byNumber = new Map(map.issues.map((node) => [node.number, node]));
  const topLevel = map.issues.filter((node) => !node.parent && node.kind !== "plan");
  const cards = topLevel.filter((node) => node.kind === "work" && node.state === "OPEN")
    .map((node) => toCard(node, byNumber, sessions))
    .sort((a, b) => b.number - a.number);

  // Shipped work is folded history, most recently closed first.
  const shipped = topLevel.filter((node) => node.state === "CLOSED")
    .sort((a, b) => String(b.closedAt).localeCompare(String(a.closedAt)))
    .map((node) => ({ ...toCard(node, byNumber, sessions), folded: true }));
  const openNumbers = new Set(cards.map((card) => card.number));

  // A decision is folded unless open work links to it.
  const decisions = map.decisions
    .map((decision) => ({
      ...decision, key: `d:${decision.id}`, numbers: decision.issues, kind: "decision",
      folded: !decision.issues.some((number) => openNumbers.has(topOf(byNumber, number))),
    }))
    .sort((a, b) => decisionNumber(b) - decisionNumber(a));
  const shownDecisions = decisions.filter((decision) => unfolded || !decision.folded);
  const questions = map.issues.filter((node) => node.kind === "question" && node.state === "OPEN")
    .sort((a, b) => b.number - a.number)
    .map((node) => ({ ...node, key: `q:${node.number}`, numbers: node.mentions, kind: "question" }));
  const shownShipped = unfolded ? shipped : [];
  const drawn = new Set([...cards, ...shownShipped].map((card) => card.number));

  // Count open parts, or the card itself without parts.
  const open = cards.flatMap((card) => (card.children.length ? card.children : [card])).filter((node) => node.status !== "done");
  return {
    cards, questions,
    decisions: shownDecisions,
    shipped: shownShipped,
    edges: collectEdges([...questions, ...shownDecisions], byNumber, drawn, openNumbers),
    foldedCount: decisions.filter((decision) => decision.folded).length + shipped.length,
    counts: Object.fromEntries(STATUSES.slice(0, 4).map((status) => [status, open.filter((node) => node.status === status).length])),
  };
}
