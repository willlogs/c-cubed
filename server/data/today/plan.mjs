// Reads a daily plan issue's checklist into Today items.
// Pure text parsing, so tests need no GitHub access.

import { captures } from "../issue-text.mjs";

/** Section kinds by heading words; the first match wins. */
const SECTION_KINDS = [
  ["decision", /decision/i],
  ["task", /\b(?:your|[\w-]+'s) tasks?\b/i],
  ["test", /\btest/i],
  ["bundle", /\bbundle\b/i],
];

/** A task-list line: bullet, checkbox, then its text. */
const CHECKBOX = /^\s*(?:[-*+]|\d+[.)])\s+\[([ xX])\]\s*(.*)$/;

/** A leading issue reference and the punctuation after it. */
const LEAD = /^#(\d+)\b[\s:.,;–—-]*/;

/** Issue and pull request references: #12 or GitHub URLs. */
const REFERENCE = /(?:#|\/issues\/|\/pull\/)(\d+)\b/g;

/** Decision ids such as D10. */
const DECISION = /\b(D\d{2,})\b/g;



/**
 * Names the section a heading opens.
 *
 * Purpose: Drop template hints such as "(tick to approve)".
 *
 * @param heading Heading text without the leading hashes.
 * @returns Section name and kind.
 */
function toSection(heading) {
  // Only the words before a parenthesis name the section.
  const name = heading.replace(/\s*\(.*$/, "").trim();
  const kind = SECTION_KINDS.find(([, pattern]) => pattern.test(name))?.[0] ?? "other";
  return { name, kind };
}



/**
 * Turns one checklist line into a Today item.
 *
 * Purpose: Split a line into its references and its note.
 *
 * @param section Section the line sits in.
 * @param box Checkbox mark: a space, x, or X.
 * @param text Line text after the checkbox.
 * @param index Position among the plan's checkbox lines.
 * @returns Item with section, kind, checked, text, numbers, decisions, note.
 */
function toItem(section, box, text, index) {
  // A leading "#37" names the item; the rest, its note.
  const lead = LEAD.exec(text);
  const note = (lead ? text.slice(lead[0].length) : text).trim();
  return {
    section: section.name,
    kind: section.kind,
    checked: box !== " ",
    // Index and text let the Map tick this exact line.
    index,
    text,
    numbers: captures(text, REFERENCE).map(Number),
    decisions: captures(note, DECISION),
    note,
  };
}



/**
 * Parses a daily plan body into its checklist items.
 *
 * Purpose: Feed Today from the plan the command center writes.
 *
 * @param body Daily plan issue body in markdown.
 * @returns Items in plan order; prose and progress lines skipped.
 */
export function parsePlan(body) {
  // Headings set the section for the lines below them.
  let section = toSection("");
  const items = [];
  for (const line of String(body ?? "").split(/\r?\n/)) {
    const heading = /^#{1,6}\s+(.*?)\s*#*$/.exec(line);
    if (heading) section = toSection(heading[1]);

    // Only checkbox lines become items; prose is skipped.
    const box = CHECKBOX.exec(line);
    if (box) items.push(toItem(section, box[1], box[2].trim(), items.length));
  }
  return items;
}



/**
 * Ticks or unticks one checklist line of a plan.
 *
 * Purpose: Change one box without touching anything else.
 *
 * @param body Plan body in markdown.
 * @param index Position among the plan's checkbox lines.
 * @param text The line's text, proving it is still there.
 * @param checked Whether the box ends up ticked.
 * @returns The new body.
 */
export function toggleLine(body, index, text, checked) {
  // Count checkbox lines the way parsePlan does.
  const source = String(body ?? "");
  const lines = source.split(/\r?\n/);
  let seen = -1;
  const at = lines.findIndex((line) => CHECKBOX.test(line) && ++seen === index);

  // A moved or edited line means the Map is stale.
  if (at < 0 || CHECKBOX.exec(lines[at])[2].trim() !== text) throw new Error("The plan changed since the Map loaded. Refresh and try again.");
  lines[at] = lines[at].replace(/\[[ xX]\]/, checked ? "[x]" : "[ ]");
  return lines.join(source.includes("\r\n") ? "\r\n" : "\n");
}
