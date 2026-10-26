// Parses, compares, and bumps product version numbers.
// Milestone titles carry them, as in "v2.1.0 — Goal".

/** Plain semver with optional prerelease: 2.0.0-beta.0. */
const NUMBER = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;

/** A version title: number, dash or colon, goal. */
const TITLE = /^v(\d+\.\d+\.\d+)\s*(?:—|–|-|:)\s*(.+)$/;

/** Bumps a version can make; minor is the default. */
export const BUMPS = ["major", "minor", "patch"];



/**
 * Parses a version number.
 *
 * Purpose: Compare and bump numbers without a semver dependency.
 *
 * @param text Number, with or without a leading "v".
 * @returns Major, minor, patch, and prerelease, or null.
 */
export function parseNumber(text) {
  // A leading "v" is fine; the rest must match.
  const match = NUMBER.exec(String(text ?? "").trim());
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]), pre: match[4] ?? "" };
}



/**
 * Orders two version numbers.
 *
 * Purpose: Find the newest version and refuse going backwards.
 *
 * @param a First number text.
 * @param b Second number text.
 * @returns Negative, zero, or positive, like a sort comparator.
 */
export function compareNumbers(a, b) {
  // A prerelease sorts before its release.
  const [left, right] = [parseNumber(a), parseNumber(b)];
  for (const part of ["major", "minor", "patch"]) {
    if (left[part] !== right[part]) return left[part] - right[part];
  }
  if (left.pre === right.pre) return 0;
  return left.pre ? (right.pre ? left.pre.localeCompare(right.pre) : -1) : 1;
}



/**
 * Bumps a version number.
 *
 * Purpose: Name the next version; prereleases drop away.
 *
 * @param text Current number, such as "2.0.0-beta.0".
 * @param bump One of BUMPS.
 * @returns Next number, such as "2.1.0".
 */
export function bumpNumber(text, bump) {
  // Reset every part below the bumped one.
  const { major, minor, patch } = parseNumber(text);
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "patch") return `${major}.${minor}.${patch + 1}`;
  return `${major}.${minor + 1}.0`;
}



/**
 * Tells which bump a planned number stands for.
 *
 * Purpose: Keep a version's kind when it must be renumbered.
 *
 * @param text Planned number, such as "3.0.0".
 * @returns major, minor, or patch.
 */
export function bumpOf(text) {
  // The lowest nonzero part names the bump.
  const { minor, patch } = parseNumber(text);
  if (patch > 0) return "patch";
  return minor > 0 ? "minor" : "major";
}



/**
 * Picks the number a new version gets.
 *
 * Purpose: Number versions in order after every planned one.
 *
 * @param current Central version on master.
 * @param planned Numbers of versions not shipped yet.
 * @param bump One of BUMPS.
 * @returns Next free number.
 */
export function nextNumber(current, planned, bump) {
  // Bump past the newest of current and planned.
  const newest = [current, ...planned].sort(compareNumbers).at(-1);
  return bumpNumber(newest, bump);
}



/**
 * Reads a milestone title as a version.
 *
 * Purpose: Tell version milestones from any others.
 *
 * @param title Milestone title.
 * @returns Number and goal, or null for other milestones.
 */
export function parseTitle(title) {
  // "v2.1.0 — Goal" with any common dash.
  const match = TITLE.exec(String(title ?? "").trim());
  return match ? { number: match[1], goal: match[2].trim() } : null;
}



/**
 * Writes a version's milestone title.
 *
 * Purpose: Keep every title in one shape.
 *
 * @param number Version number.
 * @param goal One-line goal.
 * @returns Title such as "v2.1.0 — In-app sign-in".
 */
export function formatTitle(number, goal) {
  // Em dash, as the docs show it.
  return `v${number} — ${goal}`;
}
