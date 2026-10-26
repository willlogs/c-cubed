// Checks which rows Status lists and their live state.
// Run with node --test; no GitHub, git, or stacks needed.

import assert from "node:assert/strict";
import test from "node:test";
import { buildTargets, joinRows, workerFor } from "./rows.mjs";
import { finishedPreviews } from "./worktrees.mjs";

/** GitHub and git facts behind most tests. */
const SOURCES = {
  prs: [
    { number: 41, title: "Usage share", url: "u41", headRefName: "issue-37-usage", mergeable: "MERGEABLE", files: [{ path: "tools/command-center/ui/app.js" }] },
    { number: 44, title: "Decisions", url: "u44", headRefName: "decisions", mergeable: "CONFLICTING", files: [{ path: "vault/x.md" }] },
  ],
  issues: [
    { number: 37, title: "Usage", url: "i37" },
    { number: 40, title: "Stacks", url: "i40" },
    { number: 50, title: "Home: every session at a glance", url: "i50", labels: [] },
    { number: 57, title: "Today choices", url: "i57", labels: [{ name: "decision" }] },
  ],
  branches: ["issue-37-usage", "issue-40-stacks", "issue-40-stacks", "issue-12-closed"],
  worktrees: [{ path: "/repo", head: "m", branch: "main" }, { path: "/wt/issue-40-stacks", head: "a", branch: "issue-40-stacks" }],
};

/** Nothing running, no jobs, no workers. */
const IDLE = { status: { instances: [] }, jobs: {}, previews: {}, workers: [] };


test("lists the trunk, open PRs, then open work issues", () => {
  // #37 shows as its PR; decisions are not work.
  const ids = buildTargets(SOURCES, "/repo").map((target) => target.id);
  assert.deepEqual(ids, ["trunk", "pr-44", "pr-41", "issue-50", "issue-40"]);
});



test("issues reuse their branch or name a new one", () => {
  // #40 has a branch; #50 is named from its title.
  const byId = Object.fromEntries(buildTargets(SOURCES, "/repo").map((row) => [row.id, row]));
  assert.deepEqual([byId["issue-40"].branch, byId["issue-40"].worktree, byId["issue-40"].newBranch], ["issue-40-stacks", "/wt/issue-40-stacks", null]);
  assert.deepEqual([byId["issue-50"].branch, byId["issue-50"].worktree, byId["issue-50"].newBranch], [null, null, "issue-50-home-every-session-at-a-glance"]);
  assert.equal(byId["issue-50"].instance, "issue-50-home-every-session-at-a-glance");
});


test("PR rows carry conflicts and command center previews", () => {
  // Conflicts block Start; tools/command-center adds Preview.
  const worktrees = [...SOURCES.worktrees, { path: "/wt/pr-41", head: "b", branch: null }];
  const [trunk, pr44, pr41] = buildTargets({ ...SOURCES, worktrees }, "/repo");
  assert.equal(trunk.instance, "trunk");
  assert.equal(trunk.worktree, "/repo");
  assert.deepEqual([pr44.conflict, pr44.commandCenter, pr44.worktree], [true, false, null]);
  assert.deepEqual([pr41.conflict, pr41.commandCenter, pr41.instance, pr41.worktree], [false, true, "pr-41", "/wt/pr-41"]);
});


test("overlong branch names cannot become instances", () => {
  // The launcher's name rule caps names at 41 characters.
  const branch = `issue-40-${"x".repeat(40)}`;
  const rows = buildTargets({ ...SOURCES, prs: [], branches: [branch], worktrees: [] }, "/repo");
  assert.equal(rows.find((row) => row.id === "issue-40").instance, null);
});



test("finished previews need a fresh, successful GitHub answer", () => {
  // pr-9's PR closed; pr-41's is still open.
  const worktrees = [{ path: "/wt/pr-41" }, { path: "/wt/pr-9" }, { path: "/wt/issue-40-stacks" }];
  assert.deepEqual(finishedPreviews(worktrees, SOURCES.prs, { at: "2026-10-23T22:00:00Z", error: null }), ["pr-9"]);
  assert.deepEqual(finishedPreviews(worktrees, [], { at: null, error: "GitHub unavailable" }), []);
  assert.deepEqual(finishedPreviews(worktrees, [], { at: "2026-10-23T22:00:00Z", error: "GitHub unavailable" }), []);
});


test("rows show running state and URL", () => {
  // pr-41 runs; the trunk's stack stopped answering.
  const status = {
    instances: [
      { name: "pr-41", worktree: "/wt/pr-41", ports: { app: 4100 }, state: "running", url: "http://127.0.0.1:4100" },
      { name: "trunk", worktree: "/repo", ports: { app: 4110 }, state: "degraded", url: "http://127.0.0.1:4110" },
    ],
  };
  const { rows } = joinRows(buildTargets(SOURCES, "/repo", "main"), { ...IDLE, status });
  const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
  assert.deepEqual([byId["pr-41"].state, byId["pr-41"].stackUrl], ["running", "http://127.0.0.1:4100"]);
  assert.deepEqual([byId.trunk.state, byId.trunk.label], ["degraded", "main"]);
  assert.equal(byId["pr-44"].state, "stopped");
});


test("a row's worker is the live session using that stack", () => {
  // Workers share their branch name with their stack.
  const status = { instances: [{ name: "issue-40-stacks", worktree: "/wt/issue-40-stacks", ports: { app: 4120 }, state: "running" }] };
  const workers = [{ name: "issue-40-stacks", cwd: "/wt/issue-40-stacks" }];
  const view = joinRows(buildTargets(SOURCES, "/repo"), { ...IDLE, status, workers });
  assert.equal(view.rows.find((row) => row.id === "issue-40").worker, "issue-40-stacks");
  assert.equal(workerFor("trunk", "/repo", workers), null);
  assert.equal(workerFor("other", "/wt/issue-40-stacks/", workers), "issue-40-stacks");
});


test("stacks and previews without a row stay listed", () => {
  // A merged PR's stack and preview must remain stoppable.
  const status = { instances: [{ name: "pr-9", branch: "detached", worktree: "/wt/pr-9", ports: { app: 4130 }, state: "running" }] };
  const previews = { "pr-9": { port: 8096, url: "http://127.0.0.1:8096" } };
  const view = joinRows(buildTargets(SOURCES, "/repo"), { ...IDLE, status, previews });
  assert.deepEqual(view.others.map((item) => item.id), ["stack-pr-9"]);
  assert.deepEqual(view.strayPreviews.map((item) => item.id), ["pr-9"]);
});



test("other local worktrees get rows, without duplicates", () => {
  // pr-41 duplicates the PR row; issue-40 its issue row.
  const worktrees = [
    ...SOURCES.worktrees,
    { path: "/wt/pr-41", head: "b", branch: null },
    { path: "/wt/verify-pr", head: "c", branch: "verify-pr" },
    { path: "/wt/pr-9", head: "d0123456789", branch: null },
    { path: "/wt/gone", head: "e", branch: "gone", prunable: true },
  ];
  const extra = buildTargets({ ...SOURCES, worktrees }, "/repo").filter((row) => row.kind === "worktree");
  assert.deepEqual(extra.map((row) => [row.id, row.instance, row.branch]), [
    ["worktree-pr-9", "pr-9", "detached at d01234567"],
    ["worktree-verify-pr", "verify-pr", "verify-pr"],
  ]);
});
