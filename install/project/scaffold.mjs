// Writes the project's starting files when they are missing.
// After that they are the project's; installs never rewrite them.

import fs from "node:fs";
import path from "node:path";
import { CONFIG_FILE, DEFAULTS } from "../../config/defaults.mjs";
import { listFiles, writeTemplate } from "../template/files.mjs";



/**
 * Seeds rules, decisions, and templates the project owns.
 *
 * Purpose: Give setup files to fill in, without overwriting.
 *
 * @param kitRoot Kit root holding templates/project.
 * @param projectRoot Project checkout root.
 * @param values Template values; decisions names the register path.
 * @returns Files written, and files skipped because they exist.
 *
 * Side effects: Writes files that did not exist.
 */
export function scaffoldProject(kitRoot, projectRoot, values) {
  // Settings come from init's answers, not a template.
  const source = path.join(kitRoot, "templates", "project");
  const result = { written: [], skipped: [] };
  for (const file of listFiles(source).filter((item) => item !== CONFIG_FILE)) {
    // The register follows the configured decisions path.
    const target = file === DEFAULTS.decisions ? values.decisions : file;
    const destination = path.join(projectRoot, target);
    if (fs.existsSync(destination)) {
      result.skipped.push(target);
      continue;
    }

    // Absent files are rendered once and then the project's.
    writeTemplate(path.join(source, file), destination, values);
    result.written.push(target);
  }
  return result;
}
