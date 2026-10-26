// Turns sessions, queue, events, and GitHub data into Home's picture.
// Pure data without page access, so layouts change freely.

/** Roles in the order Home draws them. */
const CONTROL = ["assistant", "master"];

/** How each hook event reads on a card. */
const VERBS = { Stop: "finished:", UserPromptSubmit: "got a message:", Notification: "asks:", SessionStart: "started", SubagentStart: "started a helper:", SubagentStop: "helper done:" };



/**
 * Tells whether a hook event came from a session.
 *
 * Purpose: Ignore other command centers and earlier runs.
 *
 * @param event Hook event from the feed.
 * @param session Session summary.
 * @param port This command center's port.
 * @returns True for this session's own events.
 */
function fromSession(event, session, port) {
  // Launch id, or name and port since it started.
  if (event.session === session.meta.sessionId) return true;
  return event.name === session.name && String(event.port) === String(port) && Date.parse(event.at) >= session.startedAt;
}



/**
 * Finds the newest activity of one session.
 *
 * Purpose: Show what each session is doing right now.
 *
 * @param session Session summary.
 * @param events Hook events, oldest first.
 * @param port This command center's port.
 * @returns Readable activity with its time, or null.
 */
function lastActivity(session, events, port) {
  // Only this session's own events count.
  const latest = events.findLast((event) => fromSession(event, session, port));
  if (!latest) return null;
  const what = latest.event === "PreToolUse" ? latest.tool : VERBS[latest.event] ?? latest.event;
  return { text: `${what ?? ""} ${latest.detail ?? ""}`.trim(), at: Date.parse(latest.at) };
}



/**
 * Collects a worker's issue and pull request.
 *
 * Purpose: Show each worker's work and its progress.
 *
 * @param number Issue number from the session, if any.
 * @param issues Map issues by number.
 * @returns Issue, newest PR, and progress step, or null.
 */
function workOf(number, issues) {
  // Merged beats open beats nothing for progress.
  if (!number) return null;
  const issue = issues.get(number) ?? { number, title: "", state: "OPEN", url: null, prs: [] };
  const pr = issue.prs?.findLast((item) => item.state === "MERGED" || item.state === "OPEN") ?? null;
  const step = pr?.state === "MERGED" || issue.state === "CLOSED" ? 3 : pr ? 2 : 1;
  return { number, title: issue.title, state: issue.state, url: issue.url, pr, step };
}



/**
 * Builds one connection between two sessions.
 *
 * Purpose: Show messages waiting and the last one delivered.
 *
 * @param from Upper or left session name.
 * @param to Lower or right session name.
 * @param queue Queue items from the server.
 * @returns Edge with waiting items and last delivery time.
 */
function edgeBetween(from, to, queue) {
  // Count messages in either direction.
  const between = queue.filter((item) => (item.from === from && item.to === to) || (item.from === to && item.to === from));
  const delivered = between.filter((item) => item.state === "delivered").map((item) => item.doneAt);
  return { from, to, waiting: between.filter((item) => item.state === "waiting"), lastAt: delivered.length ? Math.max(...delivered) : null };
}



/**
 * Describes one live session for its card.
 *
 * Purpose: Gather activity, work, and cost in one place.
 *
 * @param session Session summary.
 * @param state Browser state with events, usage, and port.
 * @param issues Map issues by number.
 * @returns Card data for the renderer.
 */
function describeCard(session, state, issues) {
  // Usage shares are keyed by launch id.
  return {
    session,
    doing: lastActivity(session, state.events, state.port),
    work: workOf(session.meta.issue, issues),
    share: state.usage?.shares?.[session.meta.sessionId],
  };
}



/**
 * Builds Home's rows, cards, and connections.
 *
 * Purpose: Give the renderer everything in one shape.
 *
 * @param state Browser state: sessions, queue, events, usage, port.
 * @param map Map data with issues and PRs, or null.
 * @returns Control sessions, workers, ended sessions, and edges.
 */
export function buildHome(state, map) {
  // Index issues once; describe every live session.
  const issues = new Map((map?.issues ?? []).map((issue) => [issue.number, issue]));
  const live = state.sessions.filter((session) => session.alive);
  const control = CONTROL.map((name) => live.find((session) => session.kind === name)).filter(Boolean);
  const workers = live.filter((session) => !CONTROL.includes(session.kind));

  // The owner talks to the assistant, which tells the master.
  const names = new Set(live.map((session) => session.name));
  const edges = [];
  if (names.has("assistant")) edges.push({ from: "owner", to: "assistant", waiting: [], lastAt: null });
  if (names.has("assistant") && names.has("master")) edges.push(edgeBetween("assistant", "master", state.queue));
  for (const worker of workers) edges.push(edgeBetween(names.has("master") ? "master" : "owner", worker.name, state.queue));
  return {
    control: control.map((session) => describeCard(session, state, issues)),
    workers: workers.map((session) => describeCard(session, state, issues)),
    ended: state.sessions.filter((session) => !session.alive),
    edges,
  };
}
