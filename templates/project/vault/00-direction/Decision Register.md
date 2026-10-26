---
status: active
updated: setup
tags: [decisions]
---

# Decision Register

## Accepted from {{owner}}

{{owner}} decides in GitHub with a line starting `Decision:`; the master adds each accepted decision here with its source and replies on the issue with its ID. Rows state only what {{owner}} said. Recommendations and reasoning stay in the issues. Agents read this table before design work, and the master reviews every pull request against it. **Enforced by** names what stops a violation: a checker in `npm run cc -- check`, the guard hook, a permission deny, or review.

| ID | Decision | Consequence | Enforced by |
| --- | --- | --- | --- |

## Proposed at setup

The command center kit proposes these founding decisions. During setup {{owner}} accepts, edits, or rejects each one. Accepted rows move to the table above as D01, D02, and so on, with the source `Setup interview <date>`. Setup deletes this table when it is empty.

### Process

| ID | Decision | Consequence | Enforced by |
| --- | --- | --- | --- |
| F01 | One trunk: every change reaches `{{trunk}}` through a pull request from an `issue-<n>-<slug>` branch | No direct pushes or force pushes; no other long-lived branches besides staging and production | guard hook, permission deny |
| F02 | {{owner}} makes product and design decisions in GitHub with a `Decision:` line | The master records them here and briefs workers with them; anything unsourced is an open question | review |
| F03 | The command center's master directs workers, reviews, and merges into `{{trunk}}` | Only important pull requests wait for {{owner}}, labeled `needs-human-review`: schema, auth, production config, removals, new modules or services | review |
| F04 | No merge without a passing `npm run cc -- verify <pr>` on the exact head | The verify merges the base into the PR and runs `npm run cc -- check`; merges use `--match-head-commit` | guard hook |
| F05 | Every pull request states a human-runnable end-to-end test and the UX risks for careless users | {{owner}} tests trunk from the daily checklist | PR template, review |
| F06 | Agent skills and rules live in the repository | Every worktree and agent shares one copy; personal memory files hold no project rules | kit install |
| F07 | Issues are sized by outcome: one result {{owner}} can test, one worker session, one careful review | Split only for review load, merge order, manual tasks, or pending decisions | review |
| F08 | Workers search before writing helpers; nothing is built twice | The master rejects re-implementations in review | review |
| F09 | Production and sensitive actions need {{owner}}'s explicit yes | Agents ask yes or no, then run the action themselves | permission deny, review |

### Architecture

| ID | Decision | Consequence | Enforced by |
| --- | --- | --- | --- |
| F10 | Code is readable: file headers, hover-card docs, step comments, comment lines of ten words or fewer, three blank lines between functions | Files stay under 300 lines; split by responsibility | cc check: readable-code |
| F11 | No folder holds more than five files; tooling-dictated roots are exempt | Group files into named subfolders by responsibility | cc check: readable-code |
{{#if hexagonal}}| F12 | TypeScript backends ({{hexagonalRoots}}) use hexagonal modules: ports in `domain/driver.ts` and `domain/driven.ts`, adapters at the edge, one composition root | Modules cross boundaries only through their own adapters | cc check: hexagonal |
{{/if}}| F13 | Every shared contract has one owner and one typed definition | No duplicated types; consumers import the contract | review |
