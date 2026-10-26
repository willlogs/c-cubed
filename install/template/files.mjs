// Writes kit-owned templates and links the kit's skills.
// Kit files are replaced on each install.

import fs from "node:fs";
import path from "node:path";
import { isTemplate, renderText } from "./engine.mjs";

/** Skill only projects with hexagonal roots receive. */
const HEXAGONAL_SKILL = ".agents/skills/enforce-ts-hexagonal-modules/";

/** Folder holding skills, each linked for Claude. */
const SKILLS = ".agents/skills/";



/**
 * Lists every file under a folder, relative and slash-separated.
 *
 * Purpose: Walk template trees, dot folders included.
 *
 * @param dir Folder to walk.
 * @returns Relative file paths; none when the folder is missing.
 */
export function listFiles(dir) {
  // Missing template folders simply contribute nothing.
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && !entry.parentPath.split(path.sep).includes("__pycache__"))
    .map((entry) => path.relative(dir, path.join(entry.parentPath, entry.name)).split(path.sep).join("/"))
    .sort();
}



/**
 * Writes one template, rendered or copied, when it changed.
 *
 * Purpose: Leave unchanged files untouched, keeping diffs quiet.
 *
 * @param source Template file.
 * @param destination Project file.
 * @param values Template values.
 * @returns "written" or "unchanged".
 *
 * Side effects: May create folders and write the file.
 */
export function writeTemplate(source, destination, values) {
  // Markdown is rendered; everything else is copied exactly.
  const content = isTemplate(source) ? Buffer.from(renderText(fs.readFileSync(source, "utf8"), values)) : fs.readFileSync(source);
  const mode = fs.statSync(source).mode & 0o777;
  if (fs.existsSync(destination) && fs.readFileSync(destination).equals(content)) return "unchanged";

  // Keep executable bits on copied scripts.
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content);
  fs.chmodSync(destination, mode);
  return "written";
}



/**
 * Removes a file, then any folders it leaves empty.
 *
 * Purpose: Clean up files a newer kit stopped shipping.
 *
 * @param projectRoot Project checkout root, never removed.
 * @param relative File path relative to the root.
 * @returns True when the file existed.
 *
 * Side effects: Deletes the file and empty parent folders.
 */
function removeOwned(projectRoot, relative) {
  // Refuse paths that escape the project.
  const file = path.resolve(projectRoot, relative);
  if (!file.startsWith(`${path.resolve(projectRoot)}${path.sep}`) || !fs.existsSync(file)) return false;
  fs.rmSync(file, { force: true });

  // Walk up while folders are empty.
  for (let dir = path.dirname(file); dir !== path.resolve(projectRoot); dir = path.dirname(dir)) {
    if (fs.readdirSync(dir).length) break;
    fs.rmdirSync(dir);
  }
  return true;
}



/**
 * Renders the kit's own templates into the project.
 *
 * Purpose: Keep skills, agents, and rules current with the kit.
 *
 * @param kitRoot Kit root holding templates/kit.
 * @param projectRoot Project checkout root.
 * @param values Template values.
 * @param previous Files the last install wrote.
 * @returns Files now owned, and which were written or removed.
 *
 * Side effects: Writes and deletes kit-owned files.
 */
export function renderKitTemplates(kitRoot, projectRoot, values, previous = []) {
  // Hexagonal rules ship only to projects that enabled them.
  const source = path.join(kitRoot, "templates", "kit");
  const files = listFiles(source).filter((file) => values.hexagonal || !file.startsWith(HEXAGONAL_SKILL));
  const written = files.filter((file) => writeTemplate(path.join(source, file), path.join(projectRoot, file), values) === "written");

  // Files the kit no longer ships are its to remove.
  const removed = previous.filter((file) => !files.includes(file) && removeOwned(projectRoot, file));
  return { files, written, unchanged: files.length - written.length, removed };
}



/**
 * Links each installed skill where Claude looks for it.
 *
 * Purpose: One copy in .agents/skills, seen through .claude/skills.
 *
 * @param projectRoot Project checkout root.
 * @param files Kit-owned files just rendered.
 * @param previous Links the last install made.
 * @returns Links owned now, created, removed, and conflicts.
 *
 * Side effects: Creates and deletes symbolic links.
 */
export function linkSkills(projectRoot, files, previous = []) {
  // Skill names are the folders directly under .agents/skills.
  const names = [...new Set(files.filter((file) => file.startsWith(SKILLS)).map((file) => file.slice(SKILLS.length).split("/")[0]))];
  const result = { links: [], created: [], removed: [], conflicts: [] };
  for (const name of names) linkOne(projectRoot, name, result);

  // Remove old links, but only links, never real folders.
  for (const link of previous.filter((item) => !result.links.includes(item))) {
    const file = path.join(projectRoot, link);
    if (fs.lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink()) {
      fs.unlinkSync(file);
      result.removed.push(link);
    }
  }
  return result;
}



/**
 * Creates one skill link, unless something else sits there.
 *
 * Purpose: Never replace a project's own skill folder.
 *
 * @param projectRoot Project checkout root.
 * @param name Skill folder name.
 * @param result Accumulated links, created, and conflicts.
 * @returns No value.
 *
 * Side effects: May create a link; updates result.
 */
function linkOne(projectRoot, name, result) {
  // A correct link is owned and left alone.
  const relative = `.claude/skills/${name}`;
  const file = path.join(projectRoot, relative);
  const target = `../../${SKILLS}${name}`;
  const existing = fs.lstatSync(file, { throwIfNoEntry: false });
  if (existing?.isSymbolicLink() && fs.readlinkSync(file) === target) {
    result.links.push(relative);
    return;
  }

  // Anything else there belongs to the project.
  if (existing) {
    result.conflicts.push(`${relative} exists and is not the kit's link; left as is.`);
    return;
  }

  // Create the link beside other Claude settings.
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.symlinkSync(target, file);
  result.links.push(relative);
  result.created.push(relative);
}
