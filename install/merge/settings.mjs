// Merges kit hooks, status line, and permissions into Claude settings.
// Project entries always survive; old kit entries are replaced.

import fs from "node:fs";
import path from "node:path";
import { KIT_FOLDER } from "../../config/defaults.mjs";

/** Marks every hook and status line the kit owns. */
const KIT_MARK = `${KIT_FOLDER}/`;

/** Events that record activity, and the Bash guard. */
const RECORD_EVENTS = ["SessionStart", "UserPromptSubmit", "PreToolUse", "Notification", "Stop", "SubagentStart", "SubagentStop"];

/** Read-only and workflow commands sessions may run unasked. */
const ALLOW = [
  "git status", "git diff", "git log", "git show", "git grep", "git fetch", "git add", "git commit",
  "git switch", "git worktree list", "git pull --ff-only", "git push -u origin issue-",
  "gh issue view", "gh issue list", "gh issue create", "gh issue comment", "gh issue edit", "gh issue close",
  "gh pr view", "gh pr list", "gh pr diff", "gh pr checks", "gh pr create", "gh pr comment", "gh pr edit",
  "gh pr update-branch", "gh pr merge", "npm run cc", "npm run status", "npm run instances",
];



/**
 * Builds one hook command entry.
 *
 * Purpose: Point Claude at a kit script in this checkout.
 *
 * @param script Kit path, such as hooks/guard.mjs.
 * @returns Hook entry with a five-second timeout.
 */
function hook(script) {
  // CLAUDE_PROJECT_DIR keeps worktrees on their own copy.
  return { type: "command", command: `node "$CLAUDE_PROJECT_DIR/${KIT_FOLDER}/${script}"`, timeout: 5 };
}



/**
 * Lists the settings entries the kit owns for a project.
 *
 * Purpose: Render hooks and branch-specific permissions once.
 *
 * @param values Template values with trunk, staging, production.
 * @returns Hooks by event, status line, allow and deny lists.
 */
export function kitSettings(values) {
  // Every event records; Bash calls also pass the guard.
  const hooks = Object.fromEntries(RECORD_EVENTS.map((event) => [event, [{ hooks: [hook("hooks/record.mjs")] }]]));
  hooks.PreToolUse = [{ matcher: "*", hooks: [hook("hooks/record.mjs")] }, { matcher: "Bash", hooks: [hook("hooks/guard.mjs")] }];

  // Branch names come from settings; protected ones deny pushes.
  const allow = [...ALLOW, `git merge origin/${values.trunk}`, `git rebase origin/${values.trunk}`].map(bash);
  const protectedBranches = [values.trunk, values.staging, values.production].filter(Boolean);
  const deny = ["git push --force", "git push -f", ...protectedBranches.map((branch) => `git push origin ${branch}`)].map(bash);
  return { hooks, statusLine: { type: "command", command: `node "$CLAUDE_PROJECT_DIR/${KIT_FOLDER}/cli/statusline.mjs"` }, allow, deny };
}



/**
 * Wraps a command prefix as a Bash permission rule.
 *
 * Purpose: Match Claude's prefix rule syntax.
 *
 * @param prefix Command prefix.
 * @returns Rule such as Bash(git status:*).
 */
function bash(prefix) {
  // The :* suffix allows any arguments after the prefix.
  return `Bash(${prefix}:*)`;
}



/**
 * Removes kit hooks, keeping every project hook.
 *
 * Purpose: Let an update replace old kit hooks cleanly.
 *
 * @param hooks Hooks by event from the settings file.
 * @returns Hooks by event without kit entries.
 */
function withoutKitHooks(hooks = {}) {
  // Drop matcher groups only when the kit emptied them.
  const result = {};
  for (const [event, groups] of Object.entries(hooks)) {
    const kept = groups.map((group) => ({ ...group, hooks: (group.hooks ?? []).filter((item) => !isKit(item.command)) }))
      .filter((group, index) => group.hooks.length || !(groups[index].hooks ?? []).length);
    if (kept.length) result[event] = kept;
  }
  return result;
}



/**
 * Tells whether a command belongs to the kit.
 *
 * Purpose: Recognize kit entries across kit versions.
 *
 * @param command Hook or status line command.
 * @returns True when it runs a kit script.
 */
function isKit(command) {
  // Every kit command runs a script under the kit folder.
  return String(command ?? "").includes(KIT_MARK);
}



/**
 * Swaps the kit's old permission rules for its new ones.
 *
 * Purpose: Update kit rules without touching the project's.
 *
 * @param current Rules in the file now.
 * @param previousKit Rules the kit added last time.
 * @param kit Rules the kit wants now.
 * @returns All rules, and those the kit added this time.
 */
function mergeRules(current = [], previousKit = [], kit = []) {
  // A rule the project already had stays the project's.
  const project = current.filter((rule) => !previousKit.includes(rule));
  const added = kit.filter((rule) => !project.includes(rule));
  return { rules: [...project, ...added], added };
}



/**
 * Merges kit entries into one settings object.
 *
 * Purpose: Install or update the kit's Claude settings.
 *
 * @param current Parsed settings file, or an empty object.
 * @param kit Entries from kitSettings.
 * @param previous Permissions the kit added last time.
 * @returns Settings, kit permissions, and any kept status line.
 */
export function mergeClaudeSettings(current, kit, previous = { allow: [], deny: [] }) {
  // Kit hooks go after the project's own.
  const hooks = withoutKitHooks(current.hooks);
  for (const [event, groups] of Object.entries(kit.hooks)) hooks[event] = [...(hooks[event] ?? []), ...groups];

  // A project's own status line wins.
  const keepStatusLine = Boolean(current.statusLine) && !isKit(current.statusLine.command);
  const allow = mergeRules(current.permissions?.allow, previous.allow, kit.allow);
  const deny = mergeRules(current.permissions?.deny, previous.deny, kit.deny);
  const permissions = { ...current.permissions, allow: allow.rules, deny: deny.rules };
  const settings = { ...current, permissions, statusLine: keepStatusLine ? current.statusLine : kit.statusLine, hooks };
  return { settings, permissions: { allow: allow.added, deny: deny.added }, statusLineKept: keepStatusLine };
}



/**
 * Applies the kit's entries to the project's settings file.
 *
 * Purpose: Wire hooks, guard, status line, and permissions.
 *
 * @param projectRoot Project checkout root.
 * @param values Template values with branch names.
 * @param previous Permissions the kit added last time.
 * @returns Whether the file changed, kit permissions, conflicts.
 *
 * Side effects: Writes .claude/settings.json when it changed.
 */
export function applyClaudeSettings(projectRoot, values, previous) {
  // A broken settings file is the project's to fix.
  const file = path.join(projectRoot, ".claude", "settings.json");
  const text = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  let current;
  try {
    current = text ? JSON.parse(text) : {};
  } catch (error) {
    return { changed: false, permissions: previous, conflicts: [`.claude/settings.json is not valid JSON (${error.message}); left as is.`] };
  }

  // Write only when the merge changed something.
  const merged = mergeClaudeSettings(current, kitSettings(values), previous);
  const next = `${JSON.stringify(merged.settings, null, 2)}\n`;
  const conflicts = merged.statusLineKept ? ["Kept the project's own statusLine; usage bars need the kit's."] : [];
  if (next === text) return { changed: false, permissions: merged.permissions, conflicts };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  return { changed: true, permissions: merged.permissions, conflicts };
}
