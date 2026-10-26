// Defines a new version: next number plus the owner's goal.
// Shared by the Versions tab form and `cc version new`.

import { readCurrent } from "./files.mjs";
import { readGitHub, toVersions } from "./github/read.mjs";
import { createMilestone } from "./github/write.mjs";
import { forgetVersions } from "./list.mjs";
import { BUMPS, formatTitle, nextNumber } from "./model/number.mjs";



/**
 * Creates the milestone for a new version.
 *
 * Purpose: Number versions in order after every open one.
 *
 * @param repoRoot Main checkout path.
 * @param request Goal, why it matters, and the bump.
 * @returns The new version's number, title, and URL.
 *
 * Side effects: Adds a milestone on GitHub.
 */
export function createVersion(repoRoot, { goal, about = "", bump = "minor" }) {
  // A version needs a one-line goal.
  const line = String(goal ?? "").trim();
  if (!line || line.includes("\n")) throw new Error("A version needs a one-line goal.");
  if (!BUMPS.includes(bump)) throw new Error(`Bump must be one of ${BUMPS.join(", ")}.`);

  // Next number after the central and every open version.
  const planned = toVersions(readGitHub(repoRoot)).filter((version) => version.open).map((version) => version.number);
  const current = readCurrent(repoRoot);
  if (!current) throw new Error("This project has no versions; set versions.file in command-center.json.");
  const number = nextNumber(current, planned, bump);
  const title = formatTitle(number, line);
  const created = createMilestone(repoRoot, title, String(about).trim());
  forgetVersions();
  return { number, title, ...created };
}
