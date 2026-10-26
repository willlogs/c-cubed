// Ends setup, re-renders kit files, and updates the kit.
// The cc CLI's project commands, apart from check and labels.

import { assertSetupComplete } from "../../config/setup.mjs";
import { mainCheckout } from "../../config/paths.mjs";
import { renderKitFiles } from "../../install/render.mjs";
import { updateKit } from "../../install/update.mjs";
import { printSummary } from "../../bin/summary.mjs";



/**
 * Finishes setup through the page, else locally.
 *
 * Purpose: Switch the running command center to normal mode.
 *
 * @param call API caller from cc.mjs.
 * @returns Promise resolving with an exit code.
 */
export async function finishSetup(call) {
  // A running server also restarts the sessions.
  try {
    console.log((await call("/setup/done", {})).message);
    return 0;
  } catch (error) {
    if (!/not running/.test(error.message)) throw error;
  }

  // Without a server, check it; the next start is normal.
  assertSetupComplete(mainCheckout());
  console.log("Setup is done. The next npm run command-center starts the assistant and the master.");
  return 0;
}



/**
 * Reads one flag's value.
 *
 * Purpose: Accept --from and --ref values.
 *
 * @param args Remaining CLI arguments.
 * @param name Flag to find.
 * @returns Value after the flag, if present.
 */
function flagValue(args, name) {
  // A missing flag returns undefined.
  return args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
}



/**
 * Runs one of the kit's project commands.
 *
 * Purpose: Keep cc.mjs a thin dispatcher.
 *
 * @param command render, update, or setup.
 * @param args Remaining CLI arguments.
 * @param call API caller from cc.mjs.
 * @returns Promise resolving with an exit code.
 */
export async function runKitCommand(command, args, call) {
  // Each command reads its own flags.
  if (command === "setup" && args[0] === "done") return finishSetup(call);
  if (command === "render") {
    printSummary(renderKitFiles(mainCheckout()));
    return 0;
  }
  if (command === "update") {
    const result = updateKit(mainCheckout(), { from: flagValue(args, "--from"), ref: flagValue(args, "--ref") });
    console.log(`Updated the kit from ${result.source}${result.ref ? ` at ${result.ref}` : ""}.`);
    return result.status ?? 0;
  }
  console.log("Usage: npm run cc -- setup done | render | update [--from <path|git-url>] [--ref <ref>]");
  return 1;
}
