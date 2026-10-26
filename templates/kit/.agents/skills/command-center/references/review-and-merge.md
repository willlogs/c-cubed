# Review and merge

Review each pull request as soon as its worker reports. A fast, honest review is what keeps many agents from degrading the codebase.

## Quick review (usually 5–10 minutes)

```bash
gh pr view <n> --comments
gh pr diff <n>
npm run cc -- verify <n>   # the full check on the PR merged with {{trunk}}
```

`npm run cc -- verify` is the gate. In the reusable `verify-pr` worktree it merges current `origin/{{trunk}}` into the PR head, runs the worktree setup only when a lockfile changed, then `npm run cc -- check`: the project's checks from `command-center.json`, then the enforcement checkers. It prints PASS or FAIL with timings, sets a `local verify` commit status on the PR head, and comments the result on the PR with the local time and both commits, so every PR carries a dated record of each verification. Check that the worker's own Verification line is filled too. On FAIL it shows each failing log's tail; send that to the worker.

Check, in order, and stop at the first hard failure:

1. **Intent:** does the change do what the issue asked, with nothing extra? A new dependency, tool, service, or user-visible behavior needs a source in the issue; otherwise it is a question for {{owner}}.
2. **Decisions:** does it follow every accepted decision in `{{decisions}}`? Decisions whose "Enforced by" says review are yours to check here.
3. **Architecture:** right layer and module{{#if hexagonal}}; ports in `domain/driver.ts` or `domain/driven.ts`; wiring only in composition{{/if}}; no cross-module reach-through. The enforcement checkers in the verify must pass.
4. **Duplication:** search for helpers the diff re-implements (`git grep` for key names). Re-implementing existing behavior is a rejection.
5. **Tests:** new behavior has tests at the right level.
6. **End-to-end test and UX risks:** present, concrete, and runnable by {{owner}}. Check that the UX risks consider confused or careless users.
7. **Conflicts with other open work:** overlapping files with other open PRs decide the merge order.

Then choose one outcome:

- **Merge:** `npm run cc -- verify <n>` printed PASS and every check above holds.
- **Fix:** small, describable issue. Message the worker, or fix it yourself in its worktree, then re-review.
- **Escalate:** the approach is wrong. Close the PR with a comment explaining why, and re-dispatch with Opus and a sharper briefing.
- **Ask {{owner}}:** label the PR `needs-human-review`, add one-paragraph context to the daily plan, and keep merging other work.

## When {{owner}} must review before merge

Label `needs-human-review` and wait when a PR:

- changes a database schema or migration;
- changes auth, permissions, billing, or account data handling;
- changes production config, CI, deployment, or these rules;
- removes or renames user-visible features;
- introduces a new module, a new external service, or a new dependency of significance;
- has more new logic than you can review carefully in one pass. Deletions and mechanical edits don't count. Prefer sending it back to be split by outcome.

Merge everything else yourself; {{owner}} checks the result on trunk.

## Merging without breaking {{trunk}}

- Merge one PR at a time, and only on a PASS from `npm run cc -- verify <n>`. The guard hook refuses `gh pr merge` while the head has no passing `local verify` status.
- Merge with the command the PASS line prints, adding a message that says what changed and why: `gh pr merge <n> --squash --delete-branch --match-head-commit <sha>`. The squash then lands exactly the verified tree, and GitHub refuses it if the worker pushed since.
- If `{{trunk}}` moved since the run, for example because you merged another PR, verify again before merging.
- On conflict, verify stops and says so. Resolve in the worker's worktree if it is mechanical; otherwise send it back with the conflicting PR named.
- After each merge: remove the worker's worktree with `npm run instances -- remove <name>`, then update trunk.

## Trunk{{#if hasStaging}}, staging,{{/if}}{{#if hasProduction}} and production{{/if}}

- **Trunk** is {{owner}}'s local test target. Run `git pull --ff-only` in the main checkout, which always stays on `{{trunk}}`.{{#if hasStacks}} Then make sure the `trunk` stack runs from it: `npm run instances -- up trunk` from the main checkout.{{/if}}
{{#if hasStaging}}- **Staging** is `{{staging}}`, cut from `{{trunk}}` once the day's work is in. {{owner}} tests there with the day's checklist.
{{/if}}{{#if hasProduction}}- **Production** is `{{production}}`. It moves only when a version ships: its promotion PR, which {{owner}} merges with a merge commit, never a squash, so `{{production}}` stays an ancestor of `{{trunk}}`.
{{/if}}
