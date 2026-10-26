// Reads command-line flags and asks init's questions.
// Questions appear only in a real terminal without --yes.

import fs from "node:fs";
import path from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { CONFIG_FILE } from "../config/defaults.mjs";
import { defaultAnswers } from "../install/project/config-file.mjs";

/** Flags every command accepts. */
const OPTIONS = {
  owner: { type: "string" }, project: { type: "string" }, trunk: { type: "string" },
  source: { type: "string" }, ref: { type: "string" },
  yes: { type: "boolean", short: "y" }, "no-install": { type: "boolean" }, help: { type: "boolean", short: "h" },
};



/**
 * Parses the command line.
 *
 * Purpose: One parser for init, new, update, and help.
 *
 * @param argv Arguments after the script path.
 * @returns Command, folder argument, and flags.
 */
export function readCommandLine(argv) {
  // The first word is the command; the second, a folder.
  const { values, positionals } = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true });
  const [command = "help", target] = positionals;
  return { command: values.help ? "help" : command, target, flags: values };
}



/**
 * Collects init's answers from flags, prompts, or defaults.
 *
 * Purpose: Ask only what flags did not answer.
 *
 * @param root Project checkout root.
 * @param flags Parsed flags.
 * @returns Project, owner, trunk, source, and ref.
 */
export async function collectAnswers(root, flags) {
  // Flags win; detection fills the rest.
  const defaults = defaultAnswers(root);
  const given = { project: flags.project, owner: flags.owner, trunk: flags.trunk };
  const answers = { ...given, source: flags.source, ref: flags.ref };
  const interactive = process.stdin.isTTY && !flags.yes && !fs.existsSync(path.join(root, CONFIG_FILE));
  if (!interactive) return answers;

  // Ask for each missing answer, showing the default.
  const terminal = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (const [key, label] of [["project", "Project name"], ["owner", "Owner, who makes the decisions"], ["trunk", "Trunk branch"]]) {
      if (given[key]) continue;
      const reply = (await terminal.question(`${label} [${defaults[key] || "none"}]: `)).trim();
      answers[key] = reply || defaults[key];
    }
  } finally {
    terminal.close();
  }
  return answers;
}
