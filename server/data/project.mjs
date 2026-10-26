// Describes the project to the page: names, mode, GitHub address.
// Kept apart so routes stay about routing.

import { spawnSync } from "node:child_process";
import { loadConfig } from "../../config/load.mjs";
import { needsSetup } from "../../config/setup.mjs";



/**
 * Describes the project for the page header and buttons.
 *
 * Purpose: Show the owner's name and setup state.
 *
 * @param repoRoot Main checkout path.
 * @returns Project, owner, trunk, mode, and GitHub address.
 */
export function describeProject(repoRoot) {
  // Mode decides the start button's words.
  const config = loadConfig(repoRoot);
  const mode = needsSetup(repoRoot) ? "setup" : "normal";
  return { project: config.project, owner: config.ownerName, trunk: config.branches.trunk, mode, repoUrl: githubUrl(repoRoot) };
}



/**
 * Reads the GitHub address of the origin remote.
 *
 * Purpose: Link sessions to their issues.
 *
 * @param repoRoot Main checkout path.
 * @returns https://github.com/owner/repo, or null.
 */
function githubUrl(repoRoot) {
  // SSH and HTTPS remotes both name owner/repo.
  const remote = spawnSync("git", ["remote", "get-url", "origin"], { cwd: repoRoot, encoding: "utf8" }).stdout?.trim() ?? "";
  const match = /github\.com[:/]([^/]+\/[^/]+?)(?:\.git)?$/.exec(remote);
  return match ? `https://github.com/${match[1]}` : null;
}
