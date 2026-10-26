// Writes and finds one version's section of CHANGELOG.md.
// Changes sort by priority, each with issue and PRs.

import { PRIORITIES, byPriority } from "../model/groups.mjs";

/** Where a section starts: "## v2.1.0 — Goal". */
const HEADING = /^## v(\d+\.\d+\.\d+)\b/;



/**
 * Writes one change as a list line.
 *
 * Purpose: Same line for planned and also-shipped changes.
 *
 * @param item Item with title, type, issue number, and PRs.
 * @param withPriority Whether to prefix the priority label.
 * @returns Markdown list line.
 */
function changeLine(item, withPriority) {
  // "Feature: Title (#85, PR #120)".
  const type = item.type ? `${item.type[0].toUpperCase()}${item.type.slice(1)}: ` : "";
  const prs = item.prs.length ? `PR${item.prs.length > 1 ? "s" : ""} ${item.prs.map((pr) => `#${pr}`).join(", ")}` : "";
  const refs = [item.number ? `#${item.number}` : "", prs].filter(Boolean).join(", ");
  const priority = withPriority && item.priority ? `${item.priority} · ` : "";
  return `- ${priority}${type}${item.title}${refs ? ` (${refs})` : ""}`;
}



/**
 * Writes the decisions and research lines.
 *
 * Purpose: Show what the version rests on.
 *
 * @param groups The version's grouped items.
 * @returns Markdown lines, possibly none.
 */
function basisLines(groups) {
  // Decision IDs come from every issue's body.
  const all = [...groups.decisions, ...groups.research, ...groups.work];
  const ids = [...new Set(all.flatMap((item) => item.decisions))].sort((a, b) => Number(a.slice(1)) - Number(b.slice(1)));
  const answered = groups.decisions.map((item) => `#${item.number} ${item.title}`);
  const decided = [ids.join(", "), answered.length ? `answered ${answered.join("; ")}` : ""].filter(Boolean).join(" · ");
  const research = groups.research.map((item) => `#${item.number} ${item.title}`).join("; ");
  return [decided && `**Decisions:** ${decided}`, research && `**Research:** ${research}`].filter(Boolean);
}



/**
 * Writes the changes, one heading per priority.
 *
 * Purpose: Read urgent changes first.
 *
 * @param work The version's work items.
 * @returns Markdown lines.
 */
function changeLines(work) {
  // P0, P1, P2, then anything unlabeled.
  if (!work.length) return ["### Changes", "", "None."];
  return [...PRIORITIES, null].flatMap((priority) => {
    const items = work.filter((item) => item.priority === priority);
    return items.length ? [`### ${priority ?? "No priority"}`, "", ...items.map((item) => changeLine(item, false)), ""] : [];
  }).slice(0, -1);
}



/**
 * Writes a version's whole changelog section.
 *
 * Purpose: One readable trail entry per shipped version.
 *
 * @param version Version with number, goal, about, url, groups.
 * @param date Release date, YYYY-MM-DD.
 * @param alsoShipped Merged changes outside the version.
 * @returns Markdown section ending in a newline.
 */
export function changelogSection(version, date, alsoShipped) {
  // Heading, goal, basis, changes, then everything else.
  const about = version.about ? ["", ...version.about.trim().split("\n").map((line) => `> ${line}`.trimEnd())] : [];
  const lines = [`## v${version.number} — ${version.goal}`, "", `Released ${date} · [Milestone](${version.url})`, ...about];
  const basis = basisLines(version.groups);
  if (basis.length) lines.push("", basis.join("  \n"));
  lines.push("", ...changeLines(version.groups.work));

  // Loose merges ship too, so the trail lists them.
  const loose = [...alsoShipped].sort(byPriority);
  if (loose.length) lines.push("", `<details><summary>Also shipped (${loose.length})</summary>`, "", ...loose.map((item) => changeLine(item, true)), "", "</details>");
  return `${lines.join("\n")}\n`;
}



/**
 * Finds one version's section in CHANGELOG.md.
 *
 * Purpose: Reuse the committed text as release notes.
 *
 * @param changelog Whole CHANGELOG.md text.
 * @param number Version number such as "2.1.0".
 * @returns Section text, or an empty string.
 */
export function findSection(changelog, number) {
  // A section runs until the next version heading.
  const lines = String(changelog ?? "").split("\n");
  const start = lines.findIndex((line) => HEADING.exec(line)?.[1] === number);
  if (start === -1) return "";
  const end = lines.findIndex((line, index) => index > start && HEADING.test(line));
  return `${lines.slice(start, end === -1 ? undefined : end).join("\n").trim()}\n`;
}



/**
 * Adds a section on top of CHANGELOG.md.
 *
 * Purpose: Keep the newest version first, under the intro.
 *
 * @param changelog Current CHANGELOG.md text, maybe empty.
 * @param section New section text.
 * @returns New CHANGELOG.md text.
 */
export function prependSection(changelog, section) {
  // Insert before the first version heading.
  const text = changelog || "# Changelog\n";
  const lines = text.split("\n");
  const first = lines.findIndex((line) => HEADING.test(line));
  const head = (first === -1 ? text : lines.slice(0, first).join("\n")).trimEnd();
  const rest = first === -1 ? "" : `\n${lines.slice(first).join("\n").trimEnd()}\n`;
  return `${head}\n\n${section.trimEnd()}\n${rest}`;
}
