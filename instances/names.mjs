// Rules for worktree and stack names, and where stacks run.
// Shared by the CLI, the Status tab, and workers.



/** Process variables that mark a hosted production machine. */
const PRODUCTION_KEYS = ["RAILWAY_ENVIRONMENT", "FLY_APP_NAME", "DYNO", "RENDER_SERVICE_ID", "VERCEL_ENV"];



/**
 * Accepts one short worktree and stack name.
 *
 * Purpose: Names become branches, folders, and stack ids.
 *
 * @param name Requested name.
 * @returns The same name when it is safe.
 */
export function assertInstanceName(name) {
  // Lowercase letters, digits, and dashes only.
  if (!/^[a-z0-9][a-z0-9-]{0,40}$/.test(name ?? "")) {
    throw new Error("Name must match ^[a-z0-9][a-z0-9-]{0,40}$.");
  }
  return name;
}



/**
 * Tells whether a name can name a worktree or stack.
 *
 * Purpose: Hide actions the CLI would refuse.
 *
 * @param name Branch or folder name.
 * @returns True when assertInstanceName accepts it.
 */
export function validName(name) {
  // Reuse the rule instead of copying it.
  try {
    assertInstanceName(name);
    return true;
  } catch {
    return false;
  }
}



/**
 * Refuses to start stacks on a production machine.
 *
 * Purpose: Keep dev stacks off hosted production.
 *
 * @param env Process environment under inspection.
 * @returns No value when this machine may run stacks.
 */
export function assertDevelopmentHost(env = process.env) {
  // Production processes must never start dev stacks.
  if (env.NODE_ENV === "production") throw new Error("Stacks refuse NODE_ENV=production.");
  const blocked = PRODUCTION_KEYS.find((key) => env[key]);
  if (blocked) throw new Error(`Stacks refuse to run where ${blocked} is set.`);
}
