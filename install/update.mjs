// Updates a project's vendored kit from a newer kit source.
// The new kit's installer runs, so layout changes travel along.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadConfig } from "../config/load.mjs";
import { mainCheckout } from "../config/paths.mjs";



/**
 * Updates the kit in one project.
 *
 * Purpose: Bring kit fixes in without touching project rules.
 *
 * @param projectRoot Project checkout root; the main one by default.
 * @param options from (path or git URL) and ref.
 * @returns Source, ref, kit folder, and installer exit code.
 *
 * Side effects: Clones to a temporary folder; rewrites the kit.
 */
export function updateKit(projectRoot = mainCheckout(), { from, ref } = {}) {
  // An explicit source wins over the recorded one.
  const config = loadConfig(projectRoot, true);
  const source = from ?? config.kit.source;
  const chosenRef = ref ?? (from ? undefined : config.kit.ref);
  const local = fs.existsSync(source);
  const temporary = local ? null : fs.mkdtempSync(path.join(os.tmpdir(), "c-cubed-update-"));

  // Run the new kit's installer, then drop any clone.
  try {
    const kitRoot = local ? path.resolve(source) : cloneKit(source, chosenRef, temporary);
    const status = runInstaller(kitRoot, projectRoot, local ? kitRoot : source, chosenRef);
    return { source, ref: chosenRef ?? null, kitRoot: local ? kitRoot : null, status };
  } finally {
    if (temporary) fs.rmSync(temporary, { recursive: true, force: true });
  }
}



/**
 * Clones one commit of the kit.
 *
 * Purpose: Fetch only what the update needs.
 *
 * @param source Git URL of the kit.
 * @param ref Branch or tag, or undefined for the default.
 * @param temporary Temporary folder to clone into.
 * @returns Path of the cloned kit.
 *
 * Side effects: Writes the clone under the temporary folder.
 */
function cloneKit(source, ref, temporary) {
  // A shallow clone is enough to install from.
  const target = path.join(temporary, "kit");
  const args = ["clone", "--quiet", "--depth", "1", ...(ref ? ["--branch", ref] : []), source, target];
  const result = spawnSync("git", args, { encoding: "utf8" });
  if (result.status !== 0) throw new Error(`git clone ${source} failed: ${(result.stderr || "").trim().split("\n")[0]}`);
  return target;
}



/**
 * Runs the new kit's update command against the project.
 *
 * Purpose: Let the newer installer do the install.
 *
 * @param kitRoot Folder of the new kit.
 * @param projectRoot Project checkout root.
 * @param source Source to record in the manifest.
 * @param ref Ref to record, if any.
 * @returns Installer exit code.
 *
 * Side effects: Whatever the installer writes; prints its summary.
 */
function runInstaller(kitRoot, projectRoot, source, ref) {
  // Output goes straight to the caller's terminal.
  const bin = path.join(kitRoot, "bin", "c-cubed.mjs");
  if (!fs.existsSync(bin)) throw new Error(`${kitRoot} has no bin/c-cubed.mjs; is it the C³ kit?`);
  const args = [bin, "update", projectRoot, "--source", source, ...(ref ? ["--ref", ref] : [])];
  return spawnSync(process.execPath, args, { stdio: "inherit" }).status ?? 1;
}
