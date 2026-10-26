// Checks the merge and branch rules the guard enforces.
// The PR lookup is faked; no GitHub calls.

import assert from "node:assert/strict";
import test from "node:test";
import { policyReason } from "./policy.mjs";

/** Branch names of a project with all three branches. */
const BRANCHES = { trunk: "main", staging: "staging", production: "production" };

/** PRs the fake lookup knows. */
const PRS = {
  7: { base: "main", head: "abc1234def", verify: "success" },
  8: { base: "main", head: "bcd2345efa", verify: "failure" },
  9: { base: "production", head: "cde3456fab", verify: "success" },
};



/**
 * Checks one command with the fake lookup.
 *
 * Purpose: Keep each assertion one line.
 *
 * @param command Bash command text.
 * @param current Branch a bare push would send.
 * @returns Reason, or null.
 */
function reason(command, current = "issue-4-x") {
  // The cwd is unused when both lookups are fake.
  return policyReason(command, BRANCHES, process.cwd(), { lookup: (number) => PRS[number] ?? null, currentBranch: () => current });
}



test("pushes to protected branches are blocked, others pass", () => {
  // Refspec destinations count, not sources.
  assert.match(reason("git push origin main"), /main changes only through/);
  assert.match(reason("git push origin HEAD:refs/heads/production"), /production/);
  assert.match(reason("cd x && git push origin staging"), /staging/);
  assert.equal(reason("git push -u origin issue-4-x"), null);
  assert.equal(reason("git push --force-with-lease origin issue-4-x"), null);
  assert.match(reason("git push", "main"), /main changes only through/);
  assert.equal(reason("git push"), null);
});



test("forced pushes are blocked anywhere", () => {
  // Force-with-lease on an issue branch stays allowed.
  assert.match(reason("git push --force origin issue-4-x"), /force/);
  assert.match(reason("git push -f"), /force/);
  assert.match(reason("git push origin +issue-4-x"), /force/);
});



test("merges need a passing local verify and a number", () => {
  // Production merges belong to the owner.
  assert.equal(reason("gh pr merge 7 --squash --delete-branch"), null);
  assert.match(reason("gh pr merge 8 --squash"), /no passing local verify/);
  assert.match(reason("gh pr merge 9 --merge"), /only the owner merges into production/);
  assert.match(reason("gh pr merge --squash"), /name the pull request number/);
  assert.match(reason("gh pr merge 99"), /GitHub did not answer/);
});



test("unrelated commands pass", () => {
  // Words alone never block.
  assert.equal(reason("echo git push origin main is blocked"), null);
  assert.equal(reason("gh pr view 8"), null);
});
