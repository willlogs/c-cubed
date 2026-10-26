// Drives the session pane's Clean and Open issue controls.
// Separate so app.js stays about connection and terminal.

import { byId, project } from "../panels.js";



/**
 * Updates the Clean and Open issue buttons.
 *
 * Purpose: Hide Clean and the link when unused.
 *
 * @param sessions Session summaries.
 * @param selected Name of the session in the terminal.
 * @returns No value.
 */
export function renderSessionActions(sessions, selected) {
  // Clean needs ended sessions; the link needs an issue.
  byId("clean-sessions").classList.toggle("hidden", !sessions.some((session) => !session.alive));
  // Issues live in the project's own GitHub repository.
  const issue = sessions.find((session) => session.name === selected)?.meta.issue;
  byId("open-issue").classList.toggle("hidden", !issue || !project.repoUrl);
  if (issue && project.repoUrl) byId("open-issue").href = `${project.repoUrl}/issues/${issue}`;
}



/**
 * Removes every ended session and its log.
 *
 * Purpose: Back the Clean button, using the existing forget route.
 *
 * @param sessions Session summaries.
 * @param selected Name of the session in the terminal.
 * @param attach Callback that shows another session.
 * @returns Promise resolving when all are removed.
 */
export async function cleanSessions(sessions, selected, attach) {
  // Leave the log first if it is about to vanish.
  const ended = sessions.filter((session) => !session.alive);
  if (ended.some((session) => session.name === selected)) attach("assistant");
  await Promise.all(ended.map((session) => fetch(`/api/stop/${encodeURIComponent(session.name)}?forget`, { method: "POST" })));
}
