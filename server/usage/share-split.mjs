// Splits account-wide 5h and weekly limit increases across sessions.
// Pure functions: old state plus a snapshot give new state.

/** Plan windows that are tracked, as named in usage.json. */
export const WINDOW_NAMES = ["five_hour", "seven_day"];



/**
 * Creates the state before any usage has been seen.
 *
 * Purpose: Give the hub a starting point to advance from.
 *
 * Inputs: None.
 *
 * @returns Empty state with no tracked windows.
 */
export function emptyShareState() {
  // Windows appear once the plan file reports them.
  return { windows: {} };
}



/**
 * Advances one window by a new percentage snapshot.
 *
 * Purpose: Apply the split rule to a single limit window.
 *
 * @param previous Tracked window, or undefined when first seen.
 * @param planWindow Window from usage.json with used_percentage and resets_at.
 * @param costs Total cost in USD keyed by session id.
 * @returns The new tracked window.
 */
function advanceWindow(previous, planWindow, costs) {
  // A new or reset window starts with zero shares.
  const percent = planWindow.used_percentage;
  if (!previous || previous.resetsAt !== planWindow.resets_at) {
    return { resetsAt: planWindow.resets_at, percent, shares: {}, baselines: { ...costs } };
  }
  if (percent < previous.percent) return { ...previous, percent };
  if (percent === previous.percent) return previous;

  // Measure what each session spent since the previous increase.
  const spent = Object.fromEntries(Object.entries(costs).map(([id, cost]) => [id, Math.max(0, cost - (previous.baselines[id] ?? 0))]));
  const totalSpent = Object.values(spent).reduce((sum, value) => sum + value, 0);

  // Increases with no session spend came from other Claude use.
  const shares = { ...previous.shares };
  if (totalSpent > 0) {
    for (const [id, value] of Object.entries(spent)) shares[id] = (shares[id] ?? 0) + (percent - previous.percent) * (value / totalSpent);
  }
  return { ...previous, percent, shares, baselines: { ...costs } };
}



/**
 * Advances every tracked window by a new usage snapshot.
 *
 * Purpose: Keep each session's share of the limits current.
 *
 * @param state Previous state from emptyShareState or this function.
 * @param plan Parsed usage.json, or null when missing.
 * @param costs Total cost in USD keyed by session id.
 * @returns The new state; the input is never changed.
 */
export function advanceShares(state, plan, costs) {
  // Windows with missing or malformed data keep their old state.
  const windows = { ...state.windows };
  for (const name of WINDOW_NAMES) {
    const planWindow = plan?.[name];
    if (typeof planWindow?.used_percentage !== "number") continue;
    windows[name] = advanceWindow(state.windows[name], planWindow, costs);
  }
  return { windows };
}



/**
 * Reads one session's shares out of the state.
 *
 * Purpose: Build the per-session numbers the UI shows.
 *
 * @param state Current share state.
 * @param sessionIds Sessions to report.
 * @returns Percentage points per window, keyed by session id.
 */
export function sharesBySession(state, sessionIds) {
  // Untracked sessions read as zero in each window.
  return Object.fromEntries(sessionIds.map((id) => [id, Object.fromEntries(
    Object.entries(state.windows).map(([name, window]) => [name, window.shares[id] ?? 0]),
  )]));
}
