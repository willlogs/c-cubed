# The daily loop

The day is designed so {{owner}} spends their time on two things, deciding and testing, while agents build in between. {{owner}} touches GitHub in two focused blocks and answers short pings in between.

| When | {{owner}} (about 2 hours total) | Command center |
|---|---|---|
| Previous evening | Drops ideas into the Inbox | Prepares tomorrow's proposals |
| Morning, 30–60 min | Approves the bundle, answers decisions | Waits, then dispatches wave 1 the moment items are ticked |
| Day | Free; answers `needs-decision` pings; adds ideas | Builds in waves, reviews, merges, updates trunk |
| Evening, 30–60 min | Tests trunk{{#if hasStaging}} or `{{staging}}`{{/if}}, ticks pass or fail | Files bugs from failures, closes the day |

Ideas {{owner}} adds during the day wait for tomorrow's bundle unless they are labeled `P0`.

## 1. Prepare decisions (evening, or morning before {{owner}} arrives)

- For each `idea` issue, write a proposed Task issue: goal, decided by, acceptance criteria, scope, end-to-end scenario, UX risks, open questions, size. Link it to the idea, then close the idea.
- Under **Decided by**, give every choice in the issue a source: a `D` number, a link to {{owner}}'s words, or code already on `{{trunk}}`. Move anything unsourced to **Open questions** or a Decision issue. {{owner}} asking for a goal does not settle how it is reached.
- Give every work issue exactly one type label, which tells {{owner}} what ticking it approves: `type:feature`, `type:bug`, or `type:chore` for code that ends in a pull request; `type:research` for a report only, with no code changes; `type:ops` for changes to running services through their CLIs. Parent issues, decisions, ideas, and daily plans carry no type. Fix a wrong type when the scope changes.
- Size issues by outcome, not by module. One issue is one result {{owner}} can see or test, finished in one worker session and one careful review. It may touch every module.
- Split only when the new logic is too much for one careful review (deletions and mechanical edits don't count), a part must merge first (a schema or shared contract), a part is {{owner}}'s manual task, or a part waits on a decision. Never split just to run more workers at once. Make each part a sub-issue of its parent.
{{#if hasVersions}}- When an issue serves an open version's goal, put it in that version's milestone. Ask {{owner}} when it is unclear which version, or when an idea is a new goal worth shipping.
{{/if}}- Name the decisions an issue follows by ID (`D10`) in its body. The Map draws its lines from these mentions and from GitHub relationships.
- Link issues with GitHub relationships, never with text. A part is a sub-issue of its parent: `gh issue create --parent <n>`, or `gh issue edit <n> --parent <parent>`. When an issue must wait for another, mark it blocked by that issue (`--blocked-by <n>` on create, `--add-blocked-by <n>` on edit) and give the reason in one line of its body. GitHub then shows each parent's parts, progress, and order, so never repeat them in the body.
- Turn every open question into a Decision issue: the question, two or three options, your recommendation, and what each option costs. Options always include any approach {{owner}} already suggested, and "not now" when the question rests on something new. Quote what {{owner}} already said, with links. Mark it as blocking the issues that cannot start until {{owner}} answers, and mention the ones it only shapes.
- Order the bundle by priority, then dependencies, then module overlap. Workers that touch different modules can run together.

Create the daily plan issue, titled `Daily plan YYYY-MM-DD` and labeled `daily-plan`:

```markdown
## Decisions needed
- [ ] #31 Keep automatic migrations on deploy? (recommend: yes)

## Proposed bundle (tick to approve; untick to skip)
- [ ] #12 Import from CSV (Sonnet, M, importer)
- [ ] #14 Empty state for the board list (Sonnet, S, client)
- [ ] #15 Retry ledger for webhooks (Opus, M, gateway, risk:schema)

## Progress
(command center appends one line per event)

## Test checklist (filled after the day's merges)

## Health report (end of day)
```

## 2. Wait for approval

Ticked boxes mean approved. {{owner}} ticks on GitHub or in the Map; a tick or untick in the Map also sends you a queue note naming the line. A comment such as "approve all" approves everything. Check the plan every 10–15 minutes, or when {{owner}} says go. Never start unapproved items, and never wait on {{owner}} for anything already approved.

## 3. Build, then 4. review and merge

Dispatch approved items in waves, following `dispatch.md`, and review each worker's result the moment it finishes, following `review-and-merge.md`. While a wave runs, prepare the next one. Append progress lines to the plan, for example: `10:42 #14 merged (Sonnet, 180k tokens)`. When the order of work changes, change the blocked-by links; GitHub tracks each part's state itself.

## 5. Hand over for testing

When the bundle is merged, or at an afternoon checkpoint:

1. Update trunk so {{owner}} can test `{{trunk}}` locally: `git pull --ff-only` in the main checkout{{#if hasStacks}}, then `npm run instances -- up trunk`{{/if}}.
2. Copy every merged PR's end-to-end test into the plan's checklist, one checkbox per scenario, grouped by area.
{{#if hasStaging}}3. Cut `{{staging}}` from `{{trunk}}` and post where to test it.
{{/if}}{{#if hasVersions}}- When every issue in a version is closed, ship it: `npm run cc -- version ship v<number>` (see the skill's Versions section).
{{/if}}

## 6. Close the day

Post the health report in the plan:

- issues merged, failed, and escalated;
- tokens per model;
- checker counts compared with yesterday (`npm run cc -- check` findings, including hidden legacy counts);
- any new duplication or boundary violations;
- tests added.

Then file bugs from failed checklist items, and prepare tomorrow's proposals.
