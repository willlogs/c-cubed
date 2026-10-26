// Checks worktree parsing and which PRs may check out.
// These tests do not call git or GitHub.

import assert from "node:assert/strict";
import test from "node:test";
import { parseWorktrees } from "../worktree/git.mjs";
import { assertOpen } from "../worktree/pull-request.mjs";


test("porcelain lists branches and detached worktrees", () => {
  // Blank lines separate worktrees; detached ones have no branch.
  const text = "worktree /repo\nHEAD aaa\nbranch refs/heads/master\n\nworktree /wt/pr-4\nHEAD bbb\ndetached\nprunable gitdir points nowhere\n";
  assert.deepEqual(parseWorktrees(text), [
    { path: "/repo", head: "aaa", branch: "master", prunable: false },
    { path: "/wt/pr-4", head: "bbb", branch: null, prunable: true },
  ]);
  assert.deepEqual(parseWorktrees(""), []);
});


test("open PRs check out; closed and merged PRs never do", () => {
  // These errors reach the Status tab as the row's message.
  assert.doesNotThrow(() => assertOpen(4, { state: "OPEN", baseRefName: "master" }));
  assert.throws(() => assertOpen(4, { state: "MERGED" }), /#4 is merged, not open/);
  assert.throws(() => assertOpen(4, { state: "CLOSED" }), /#4 is closed, not open/);
});
