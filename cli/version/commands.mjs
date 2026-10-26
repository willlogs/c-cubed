// Runs `npm run cc -- version …`: list, show, new, add, ship.
// Works on GitHub directly, so the server need not run.

import { createVersion } from "../../versions/create.mjs";
import { checkoutRoot } from "../../versions/github/gh.mjs";
import { addIssues } from "../../versions/github/write.mjs";
import { findVersion, listVersions } from "../../versions/list.mjs";
import { shipVersion } from "../../versions/ship/advance.mjs";
import { listText, showText } from "./print.mjs";

/** Usage lines for the version commands. */
export const VERSION_USAGE = `  version                                    list the current, open, and shipped versions
  version show <v>                           one version's track, issues, and release PRs
  version new <goal...> [--why <text>] [--major|--patch]   define the next version
  version add <v> <issue...>                 put issues into a version
  version ship <v> [--dry-run]               run the version's next release step`;



/**
 * Splits arguments into words and flag values.
 *
 * Purpose: Keep argument parsing dependency-free.
 *
 * @param args Arguments after the subcommand.
 * @returns Positional words and a flag lookup.
 */
function parse(args) {
  // "--why" takes the next word; other flags are switches.
  const words = [];
  const flags = {};
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--why") flags.why = args[++index];
    else if (args[index].startsWith("--")) flags[args[index].slice(2)] = true;
    else words.push(args[index]);
  }
  return { words, flags };
}



/**
 * Runs one version subcommand.
 *
 * Purpose: Map version commands onto the versions module.
 *
 * @param args Arguments after "version".
 * @returns Promise resolving with the exit code.
 */
export async function runVersion(args) {
  // GitHub and the trunk are shared by every checkout.
  const repoRoot = checkoutRoot();
  const [command = "list", ...rest] = args;
  const { words, flags } = parse(rest);
  if (command === "list") {
    console.log(listText(listVersions(repoRoot, true)));
    return 0;
  }
  if (command === "show") {
    const views = listVersions(repoRoot, true);
    console.log(showText(findVersion([...views.open, ...views.shipped], words[0])));
    return 0;
  }

  // Writes: define, fill, and ship.
  if (command === "new") {
    const bump = flags.major ? "major" : flags.patch ? "patch" : "minor";
    const created = createVersion(repoRoot, { goal: words.join(" "), about: flags.why ?? "", bump });
    console.log(`Defined ${created.title}\n${created.url}\nAdd its issues: npm run cc -- version add v${created.number} <issue...>`);
    return 0;
  }
  if (command === "add") {
    const views = listVersions(repoRoot, true);
    const version = findVersion(views.open, words[0]);
    const numbers = words.slice(1).map((word) => Number(word.replace(/^#/, "")));
    if (!numbers.length || numbers.some((number) => !Number.isInteger(number))) throw new Error("Name issues by number: version add v2.1.0 12 14");
    addIssues(repoRoot, version.title, numbers);
    console.log(`Added ${words.slice(1).join(", ")} to ${version.title}.`);
    return 0;
  }
  if (command === "ship") {
    const result = shipVersion(repoRoot, words[0], Boolean(flags["dry-run"]));
    console.log(result.text);
    return result.code;
  }
  console.log(`Usage: npm run cc --\n${VERSION_USAGE}`);
  return 1;
}
