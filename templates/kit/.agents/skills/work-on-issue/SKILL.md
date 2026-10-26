---
name: work-on-issue
description: Takes a GitHub issue in this repository from pickup to an open pull request. Reads the issue with gh, creates an isolated worktree with npm run instances -- new, implements only the issue's scope, runs npm run cc -- check, and opens a PR that closes the issue. Use whenever you are asked to work on, fix, implement, pick up, or continue a GitHub issue or issue number (such as "do #42" or "take issue 42"), or to open a pull request for finished issue work.
---

# Work on an issue

Each issue gets one branch, one worktree, and one pull request. Several agents work at once, so isolation and a small, finished PR matter more than speed. The master reviews every PR and {{owner}} reviews the ones the template marks; make each easy to review. A worker the command center started skips step 3, because its worktree exists and the master tracks it, and sends questions to the master instead of labeling the issue.

## 1. Read the contract

```bash
gh issue view <number> --comments
```

The issue's goal, acceptance criteria, scope, and risks are your contract. If acceptance criteria are missing, or the scope is unclear or too large for one PR, stop. Comment your questions on the issue, add the `needs-decision` label, and report back. Never guess at product decisions.

## 2. Check for collisions

Issues labeled `risk:schema` or `risk:contracts` run one at a time. Before starting one, check that no other is in flight:

```bash
gh pr list --state open --label risk:schema
gh pr list --state open --label risk:contracts
```

If one is open, stop and report which PR blocks you.

## 3. Create your worktree

```bash
npm run instances -- new issue-<number>-<short-slug>
cd {{worktrees}}/issue-<number>-<short-slug>
gh issue comment <number> --body "Started on branch issue-<number>-<short-slug>."
```

Work only inside that worktree. Never edit the main checkout or another agent's worktree.

## 4. Implement within scope

- Read the root `AGENTS.md` and any `AGENTS.md` in folders you touch.
- Apply the `write-readable-code` skill{{#if hexagonal}} and the `enforce-ts-hexagonal-modules` skill{{/if}}.
- Follow every accepted decision in `{{decisions}}` that touches your change.
- Change only what the acceptance criteria need. Record unrelated problems as new issues with `gh issue create` instead of fixing them here.
- Commit in small, explained steps.

## 5. Verify

```bash
npm run cc -- check   # the project's checks, then the enforcement checkers
```

Run it right before opening the pull request, and fill its Verification line: when it ran, on which commit, and the result. This command, and the master's `npm run cc -- verify <pr>` before it merges, are the gate, so do not wait for GitHub checks.

Fix every failure. Plain findings and `(touched legacy code)` findings both fail it: report any that need work outside your issue to the master before widening the change. A `setup/typescript` error, a `Skipped` note, or `Checked 0 files` for code you changed means that code was not checked: fix the setup and rerun.
{{#if hasStacks}}

When the change affects the running app, start your stack and check it, then stop it:

```bash
npm run instances -- up issue-<number>-<short-slug>
npm run instances -- down issue-<number>-<short-slug>
```
{{/if}}

## 6. Open the pull request

```bash
git push -u origin issue-<number>-<short-slug>
gh pr create --base {{trunk}} --title "<what changed>" --body-file <filled template>
```

Fill `.github/pull_request_template.md`: `Closes #<number>`, what changed, the verification you ran, and every risk box that applies. Give the PR the issue's `risk:*` labels (`gh pr edit <pr> --add-label risk:schema`), because collision checks read PR labels.{{#if hasStacks}} Then stop your stack.{{/if}} Report the PR link. Leave the worktree until the PR merges; afterwards run `npm run instances -- remove <name>`.

- **`type:research`:** the PR changes only the report's folder and the links the issue names. Every "none", "absent", or "no X exists" finding names the search behind it (command and paths), so a reviewer can rerun it. Mark each fact about production as read from production, with the command and date, or as inferred from the repository.
- **`type:ops`:** each step that changes a running service waits for {{owner}}'s go-ahead on the issue. Record what you ran and what it printed.

## Never

- Push to a protected branch (`{{trunk}}`{{#if hasStaging}}, `{{staging}}`{{/if}}{{#if hasProduction}}, `{{production}}`{{/if}}), force push, or merge your own pull request.
- Run production migrations, or change production config or data.
- Weaken a checker, or skip `npm run cc -- check`, to make a change pass.
{{#if hasStacks}}- Leave a stack running after you finish.
{{/if}}
