// Checks the local PR merge against a throwaway git repository.
// Runs git only; never GitHub.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { mergeBase, mergeTree } from "../worktree/pull-request.mjs";

/**
 * Runs git in a folder and returns its trimmed output.
 *
 * Purpose: Keep each test step one short line.
 *
 * @param cwd Repository folder.
 * @param args Git arguments.
 * @returns Trimmed standard output.
 */
function git(cwd, ...args) {
  // Fail loudly so a broken fixture never passes.
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}



/**
 * Builds a repository where master and a PR branch diverge.
 *
 * Purpose: Give each test a base and a head.
 *
 * @param prFile File the PR branch writes.
 * @param prText Text the PR branch writes there.
 * @returns Repository folder, head and base commits.
 */
function divergedRepository(prFile, prText) {
  // Master gains a commit after the PR branches off.
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), "pr-merge-"));
  git(repo, "init", "--quiet", "--initial-branch=master");
  git(repo, "config", "user.name", "Test");
  git(repo, "config", "user.email", "test@example.com");
  fs.writeFileSync(path.join(repo, "shared.txt"), "start\n");
  git(repo, "add", ".");
  git(repo, "commit", "--quiet", "-m", "start");
  git(repo, "checkout", "--quiet", "-b", "pr");
  fs.writeFileSync(path.join(repo, prFile), prText);
  git(repo, "add", ".");
  git(repo, "commit", "--quiet", "-m", "pr");
  git(repo, "checkout", "--quiet", "master");
  fs.writeFileSync(path.join(repo, "shared.txt"), "master moved\n");
  git(repo, "commit", "--quiet", "-am", "master");
  return { repo, head: git(repo, "rev-parse", "pr"), base: git(repo, "rev-parse", "master") };
}


test("a clean PR merges into the tree merge-tree predicted", () => {
  // The worktree's tree must equal the predicted tree.
  const { repo, head, base } = divergedRepository("feature.txt", "new\n");
  const target = { head, base, baseName: "master" };
  const tree = mergeTree(7, target, repo);
  git(repo, "checkout", "--quiet", "--detach", head);
  mergeBase(7, target, repo);
  assert.equal(git(repo, "rev-parse", "HEAD^{tree}"), tree);
  assert.equal(git(repo, "rev-parse", "HEAD^1"), head);
  assert.equal(git(repo, "rev-parse", "HEAD^2"), base);
});


test("a conflicting PR fails before and during the merge", () => {
  // Both sides changed shared.txt differently.
  const { repo, head, base } = divergedRepository("shared.txt", "pr changed it\n");
  const target = { head, base, baseName: "master" };
  assert.throws(() => mergeTree(7, target, repo), /#7 conflicts with master/);
  git(repo, "checkout", "--quiet", "--detach", head);
  assert.throws(() => mergeBase(7, target, repo), /#7 conflicts with master/);
  assert.equal(git(repo, "status", "--porcelain"), "");
});
