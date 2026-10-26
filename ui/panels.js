// Renders the activity feed and usage bars, plus shared helpers.
// Pure rendering: app.js owns state and the connection.

/** How many feed rows to keep on screen. */
const FEED_LIMIT = 250;

/** The project, its owner, and setup mode, from /api/project. */
export const project = { project: "", owner: "the owner", trunk: "main", mode: "normal", repoUrl: null };



/**
 * Finds a page element by id.
 *
 * Purpose: Shorten the many element lookups.
 *
 * @param id Element id.
 * @returns The element, or null.
 */
export function byId(id) {
  // Thin wrapper kept for readability.
  return document.getElementById(id);
}



/**
 * Escapes text for safe insertion into HTML.
 *
 * Purpose: Show GitHub titles and commands without injection.
 *
 * @param value Any value to display.
 * @returns HTML-safe text.
 */
export function escapeHtml(value) {
  // Replace the five HTML-significant characters.
  return String(value ?? "").replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}



/**
 * Names the session an event came from.
 *
 * Purpose: Label events from launched and unknown sessions.
 *
 * @param event Hook event with session id and cwd.
 * @param sessions Known sessions with their ids.
 * @returns Session name, or the folder name.
 */
export function sessionLabel(event, sessions) {
  // Launched sessions carry our id, or their name and port.
  const known = sessions.find((item) => item.meta?.sessionId === event.session);
  if (known) return known.name;
  if (event.name) return String(event.port) === location.port ? event.name : `${event.name}:${event.port}`;
  return (event.cwd ?? "").split("/").pop() ?? "unknown";
}



/**
 * Renders the newest events, optionally for one session.
 *
 * Purpose: Show what every session is doing right now.
 *
 * @param list Feed list element.
 * @param events All received events, oldest first.
 * @param sessions Known sessions.
 * @param only Session name to show, or null for all.
 * @returns No value.
 */
export function renderFeed(list, events, sessions, only) {
  // Newest first, filtered, and capped.
  const rows = events.slice().reverse()
    .filter((event) => !only || sessionLabel(event, sessions) === only)
    .slice(0, FEED_LIMIT);
  list.innerHTML = rows.map((event) => `<li class="${escapeHtml(event.event)}">
    <span class="when">${escapeHtml(event.at?.slice(11, 19))}</span><span class="who">${escapeHtml(sessionLabel(event, sessions))}</span>
    ${escapeHtml(event.tool ?? event.event)} ${escapeHtml(event.detail)}</li>`).join("");
}



/** Length of each plan window, in seconds. */
const WINDOW_SECONDS = { "5h": 5 * 3600, "7d": 7 * 86_400 };



/**
 * Says how far through its window a limit is.
 *
 * Purpose: Draw the even-spending pace under the usage.
 *
 * @param label Window name such as 5h.
 * @param resetsAt Reset time in epoch seconds.
 * @returns Percent of the window elapsed, or null when unknown.
 */
function pacePercent(label, resetsAt) {
  // A past reset means stale data, so skip the pace.
  const left = resetsAt - Date.now() / 1000;
  if (!Number.isFinite(left) || left <= 0) return null;
  return Math.min(100, Math.max(0, 100 * (1 - left / WINDOW_SECONDS[label])));
}



/**
 * Formats when a window resets.
 *
 * Purpose: Show the clock time, plus the day for 7d.
 *
 * @param label Window name such as 5h.
 * @param resetsAt Reset time in epoch seconds.
 * @returns Clock text and a countdown, such as 2h 10m.
 */
function resetText(label, resetsAt) {
  // Hours and minutes under a day, else days and hours.
  const at = new Date(resetsAt * 1000);
  const clock = at.toLocaleString([], { ...(label === "7d" ? { weekday: "short" } : {}), hour: "numeric", minute: "2-digit" });
  const minutes = Math.max(0, Math.round((resetsAt - Date.now() / 1000) / 60));
  const hours = Math.floor(minutes / 60);
  const left = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h ${minutes % 60}m`;
  return { clock, left };
}



/**
 * Draws one usage window as a labeled bar.
 *
 * Purpose: Compare spending with even pace, and warn near limits.
 *
 * @param label Window name such as 5h.
 * @param window Rate-limit window from the status line.
 * @returns HTML for the bar, its pace, and reset time.
 */
function usageBar(label, window) {
  // Color follows the command center's throttle points.
  const used = Math.round(window?.used_percentage ?? 0);
  const level = used >= 85 ? "bad" : used >= 70 ? "warn" : "";
  const pace = pacePercent(label, window?.resets_at);
  if (pace === null) return `<span class="window">${label} ${used}%<span class="bar"><span class="${level}" style="width:${used}%"></span></span></span>`;

  // The band is the even pace; overspending shows amber.
  const gap = Math.round(used - pace);
  const over = gap > 0 ? `<span class="${level ? "bad" : "warn"}" style="left:${pace}%;width:${used - pace}%"></span>` : "";
  const reset = resetText(label, window.resets_at);
  const title = `${label} limit: ${used}% used; even pace by now is ${Math.round(pace)}%, so ${Math.abs(gap)} points ${gap > 0 ? "over" : "under"}. Resets ${reset.clock}, in ${reset.left}.`;
  return `<span class="window" title="${escapeHtml(title)}">${label} ${used}%<span class="bar"><span class="pace" style="width:${pace}%"></span>
    <span class="${level}" style="width:${used}%"></span>${over}</span><span class="reset">resets ${escapeHtml(reset.clock)}</span></span>`;
}



/**
 * Renders the 5-hour and weekly plan bars.
 *
 * Purpose: Keep plan usage visible while agents run.
 *
 * @param element Header usage element.
 * @param usage Usage payload from the server.
 * @returns No value.
 */
export function renderUsage(element, usage) {
  // Unknown until any Claude session draws its status line.
  const plan = usage?.plan;
  if (!plan) {
    element.textContent = "usage: waiting for a session";
    return;
  }
  element.innerHTML = usageBar("5h", plan.five_hour) + usageBar("7d", plan.seven_day);
}
