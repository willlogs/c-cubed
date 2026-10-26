// Shows the selected session in one browser terminal.
// Refits on size changes and asks for a fresh screen.

/** Quiet time after the last change before refreshing. */
const SETTLE_MS = 100;

/** The single terminal that shows the selected session. */
export const terminal = new Terminal({ fontSize: 13, scrollback: 5000, theme: { background: "#0f1115" } });

/** Fits the terminal to its host element. */
const fit = new FitAddon.FitAddon();

/** Host element, the screen request, and the settle timer. */
const view = { host: null, request: null, timer: null };



/**
 * Opens the terminal and refreshes it on every size change.
 *
 * Purpose: Keep the terminal fitted and drawn like the session.
 *
 * @param host Element the terminal fills.
 * @param request Callback that asks the server for the screen.
 * @param onInput Callback for typed input.
 * @returns No value.
 */
export function openTerminal(host, request, onInput) {
  // Pane resizes, tab switches, and refocus all refresh.
  Object.assign(view, { host, request });
  terminal.loadAddon(fit);
  terminal.open(host);
  terminal.onData(onInput);
  new ResizeObserver(scheduleRefresh).observe(host);
  document.addEventListener("visibilitychange", scheduleRefresh);
  window.addEventListener("focus", scheduleRefresh);
}



/**
 * Refreshes once size changes settle.
 *
 * Purpose: Resize the session once per drag, not every frame.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
function scheduleRefresh() {
  // Each change restarts the wait.
  clearTimeout(view.timer);
  view.timer = setTimeout(refreshTerminal, SETTLE_MS);
}



/**
 * Fits the terminal and asks for the session's screen.
 *
 * Purpose: One redraw path for switches, resizes, and refocus.
 *
 * Inputs: None.
 *
 * @returns No value.
 */
export function refreshTerminal() {
  // Hidden pages and tabs wait until they are shown.
  if (document.hidden || !view.host?.clientWidth) return;

  // Fonts can measure late on first show; retry then.
  const size = fit.proposeDimensions();
  if (!size?.cols || !size?.rows) return scheduleRefresh();
  fit.fit();
  view.request({ cols: terminal.cols, rows: terminal.rows });
}
