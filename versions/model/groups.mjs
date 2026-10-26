// Sorts a version's issues into decisions, research, and work.
// Priority order is P0, P1, P2, then unlabeled.

/** Priority labels, most urgent first. */
export const PRIORITIES = ["P0", "P1", "P2"];

/** Work type labels in changelog order. */
export const TYPES = ["feature", "bug", "chore", "ops", "research"];



/**
 * Turns one GitHub issue into a version item.
 *
 * Purpose: Give every view the same small issue shape.
 *
 * @param issue Issue with label names and linked PRs.
 * @returns Item with group, priority, type, and merged PRs.
 */
export function toItem(issue) {
  // Labels decide the group; type:research is research.
  const labels = issue.labels;
  const type = TYPES.find((name) => labels.includes(`type:${name}`)) ?? null;
  const group = labels.includes("decision") ? "decisions" : type === "research" ? "research" : "work";
  return {
    number: issue.number, title: issue.title, url: issue.url, open: issue.state === "OPEN", group, type,
    priority: PRIORITIES.find((name) => labels.includes(name)) ?? null,
    decisions: issue.decisions ?? [],
    prs: (issue.prs ?? []).filter((pr) => pr.state === "MERGED").map((pr) => pr.number),
  };
}



/**
 * Ranks a label value within its ordered list.
 *
 * Purpose: Sort missing labels after every known one.
 *
 * @param list Ordered label values.
 * @param value Value to rank, maybe null.
 * @returns Its index, or the list length when absent.
 */
function rank(list, value) {
  // Absent values rank last.
  return list.includes(value) ? list.indexOf(value) : list.length;
}



/**
 * Orders items by priority, then type, then number.
 *
 * Purpose: The changelog and views list urgent work first.
 *
 * @param a First item.
 * @param b Second item.
 * @returns Sort comparator result.
 */
export function byPriority(a, b) {
  // Unlabeled sorts after every priority and type.
  return rank(PRIORITIES, a.priority) - rank(PRIORITIES, b.priority)
    || rank(TYPES, a.type) - rank(TYPES, b.type)
    || a.number - b.number;
}



/**
 * Groups a version's issues for its views.
 *
 * Purpose: Count and list each stage's issues.
 *
 * @param issues Issues in the version's milestone.
 * @returns Decisions, research, and work lists, sorted.
 */
export function groupIssues(issues) {
  // Every list is sorted by priority.
  const items = issues.map(toItem).sort(byPriority);
  return {
    decisions: items.filter((item) => item.group === "decisions"),
    research: items.filter((item) => item.group === "research"),
    work: items.filter((item) => item.group === "work"),
  };
}
