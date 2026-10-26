# Daily use

The owner decides; the command center builds. This page is how the owner runs a project from GitHub with two focused blocks a day. Skim the top; read a section when you need it.

```text
 Owner (GitHub)               Command center (Opus, a local page)          Workers (Sonnet/Opus)
 ideas, decisions, approvals ─► plans, briefs, reviews, merges ──────────► one issue, one PR each
          ▲                                  │
          └──────── test trunk ◄──────── trunk ──► staging ──► production (per version, the owner merges)
```

Staging and production are optional. The project's `command-center.json` says which branches exist.

## The owner's day

| When | Owner | Meanwhile |
|---|---|---|
| Evening before | Drops ideas into GitHub | The master prepares tomorrow's proposals |
| Morning, 30–60 min | Opens the daily plan, or the Map's Today panel: ticks the bundle, answers decisions | Building starts on each item as soon as it is ticked |
| Day | Free. Answers `needs-decision` pings; adds ideas | Workers build in waves; the master reviews and merges into trunk |
| Evening, 30–60 min | Tests trunk with the day's checklist; merges a version's promotion PR when one is ready | Failures become bugs for tomorrow |

Ideas added during the day wait for tomorrow's bundle. Label one `P0` to make it today's work.

## Start the command center

Start it each morning from the main checkout, in a terminal you keep open:

```bash
git pull --ff-only
npm run command-center   # opens http://127.0.0.1:8095
```

**First run:** the command center starts in setup mode. Only the setup session runs. In a new folder, Claude Code first asks whether you trust it: answer in the Sessions tab. Then press **Start setup**, and it interviews you about the product, branches, commands, and architecture, then writes the project's rules and founding decisions. When it runs `npm run cc -- setup done`, the normal sessions start.

**Every later run:** two Opus sessions start idle, both in auto mode:

- **The assistant** is yours. Press **Start the day**, or just type to it. It answers from GitHub and the command center, files your ideas, and passes work to the master.
- **The master** directs the workers. Workers report to it, and the assistant relays your requests to it.

Messages to a busy session wait in a **queue** and arrive when its current turn ends, so nobody interrupts the master mid-task. The assistant tells you when your request is waiting. You can cancel a waiting message on the page, or ask the assistant to.

| On the page | What it is |
|---|---|
| Home | You, the assistant, the master, and every worker as cards joined by lines. Each card shows what the session does now, its issue and pull request, and progress. Waiting messages sit on their line, with Cancel below. Click a card to open its terminal. |
| Sessions | The session list and the queue, beside the selected session's live terminal. Type into it to talk to that session directly. Green means working, amber means it waits for you. |
| Activity | Every tool call from every Claude session in this repository, including ones you start yourself. |
| Usage | Your 5-hour and weekly plan limits with reset times, and each session's share. A blue band under each bar is the even pace so far: an amber tail means you are spending ahead of it. |
| Map | Today: what needs you, what is moving, and why. Below it, decisions, open work, and questions as a graph. |
| Progress | Pull requests merged, decisions made, and issues closed: headline totals, a heatmap of merges per day, and a day-by-day map of decisions over merges. |
| Versions | Each open version's goal, stage, track, issues by priority, and release PRs, plus **Define a version** and the changelog of shipped ones. Shown when the project tracks versions. |
| Status | Trunk, every open pull request and issue, and other worktrees. **Create worktree** checks one out (a PR merged with trunk, or the issue's branch). With stacks configured: **Start** and **Stop** a running copy of the app. **Remove** deletes a worktree. Finished PR previews remove themselves. |

Ctrl-C in its terminal stops the assistant, the master, every worker, and the page. Their state lives in GitHub, so the next start picks up where they left off. Sessions know they run inside the command center, and a guard stops them from killing it.

**After a merge that changes the command center** (`tools/command-center`), restart to load the new code: Ctrl-C, then `git pull --ff-only && npm run command-center`. Reload the page only after restarting.

## What to say to the assistant

Plain sentences work. The assistant answers what it can and passes work on to the master.

- "What needs me?": open decisions, today's plan, and PRs waiting for you.
- "Add these ideas: …": it files them as issues for the next plan.
- "Start the approved items.": the master dispatches workers; ticking the plan does the same.
- "How is #22 going?": it reads the worker's report or screen.
- "Stop the worker on #22.": it asks the master to stop that worker.
- "Review and merge what's ready.": the master reviews open PRs and merges the safe ones.
- "Cancel that." or "Stop the master.": the assistant cancels the waiting message, or interrupts the master's current turn.

From another terminal, `npm run cc -- send assistant "<message>"` queues the same message.

## Commands at a glance

| Command | Shows or does |
|---|---|
| `npm run command-center` | Starts the page and the sessions (setup mode on the first run) |
| `npm run status` | Stacks, versions, today's plan, open PRs, usage |
| `npm run cc -- sessions` | Each Claude session: working, idle, or waiting, and for how long |
| `npm run cc -- send <name> "<message>"` | Queues a message; it arrives when the session's turn ends and nothing is typed in its input box |
| `npm run cc -- queue` | Waiting messages; `queue cancel <id>` takes one back |
| `npm run cc -- screen <name>` | A session's recent output |
| `npm run cc -- stop <name>` | Stops one worker session |
| `npm run cc -- check` | The gate: the project's checks, then the enforcement checkers |
| `npm run cc -- verify <pr>` | The gate on a PR merged with trunk, recorded on the PR |
| `npm run instances -- status` | Worktrees and running stacks |
| `npm run cc -- version` | The current version, each open version's stage and next step |
| `npm run cc -- render` | Rewrites the kit's files after `command-center.json` changes |
| `npm run cc -- update` | Pulls a newer command center kit; the project's own rules stay |

## Capture an idea

New issue, labeled `idea`. One or two rough sentences; add `P0` if it matters today. The master turns it into a Task with acceptance criteria, an end-to-end scenario, and UX risks, then proposes it in a daily plan.

## Approve work

Each day has one issue titled `Daily plan YYYY-MM-DD`. Tick the bundle items you approve, or comment `approve all`. You can also tick lines in the Map's Today panel: the tick saves to the issue and tells the master at once. Unticked items are skipped. Approved items start right away, in an order that keeps workers out of each other's modules.

## Make a decision

Write one line anywhere in GitHub: on a Decision issue, the daily plan, an issue, or a PR.

```text
Decision: B, but only for new accounts.
Decision: Empty boards show the import button, not a blank table. Why: first-run users get stuck.
```

Agents treat only your words as decided: every issue lists what it rests on under **Decided by**, and anything else becomes a question for you. The master records each decision in the Decision Register with an ID such as D16 and what enforces it, replies with that ID, and briefs every future worker with it. Decision issues it raises always list options and its recommendation, so most answers are one letter.

## Test

- **Trunk** is everything merged so far, running locally from the main checkout. The daily plan's test checklist collects every merged PR's end-to-end test.
- Tick passing items, in the plan or the Map. For a failure, comment `fail: <what happened>` under the plan; it becomes a bug issue for tomorrow.

## Versions and shipping

A version is a goal worth shipping: its decisions, research, and work, then one release. Use **Define a version** in the Versions tab, or tell the assistant the goal. It becomes a GitHub milestone such as `v2.1.0 — In-app sign-in`.

When every issue in it is closed, the master runs `npm run cc -- version ship`:

1. A release PR into trunk sets the version and adds its changelog section. The master merges it.
2. With a production branch, a promotion PR frozen at that release commit goes into production. **Merge it yourself with "Create a merge commit"**, never squash.
3. The master tags the version, publishes the GitHub Release, and closes the milestone.

## How big an issue is

An issue is **one result you can see or test**, sized for one worker session and one careful review. It may touch every module: the "owned modules" in a worker's brief are a lock while it runs, so no other worker touches them until it finishes.

A goal is split only when the new logic is too much for one careful review, a part must merge first (a schema or shared contract), a part is your manual task, or a part waits on your decision. Then it becomes a parent issue whose parts are GitHub sub-issues, each a result of its own.

## The Map

The Map opens on **Today**, built from the newest open daily plan:

- **Needs you:** open decisions, your tasks from the plan, PRs labeled `needs-human-review`, unticked plan lines, and blocked issues.
- **In progress** and **Up next:** approved items, plus any issue a worker or an open PR is moving.
- **Done today:** what the plan finished.

Each item has a one-line reason: the decisions it follows, the goal it is part of, or the plan line's note. Below Today, a graph joins decisions, open work, and questions waiting on you. Links come from GitHub sub-issues and blocked-by relationships, decision IDs such as `D10` in issue bodies, and issue numbers in the register.

## When the master asks you to review a PR

It merges most PRs itself after review. It labels a PR `needs-human-review` and waits for you when a box under **Needs the owner's review** in the PR template is ticked, or when the PR is too large to review confidently. Read the end-to-end test and the "what could go wrong" section first.

## Guardrails

| Risk | What catches it |
|---|---|
| Broken build or behavior | The project's checks in `npm run cc -- check`, run by workers and by the master's `npm run cc -- verify <pr>` before each merge |
| An unverified merge | The guard hook refuses `gh pr merge` until the PR head has a passing `local verify` status |
| Pushes around review | The guard hook and permission denies block direct and force pushes to protected branches |
| Messy code, missing docs, big files, crowded folders | The readable-code checker in `npm run cc -- check` |
| Modules reaching into each other | The hexagonal scanner, when the project enables it, and the master's review |
| Duplicate helpers or parallel implementations | The master's review: it searches before accepting new helpers |
| Two agents colliding | Module locks when dispatching; schema and contract work runs alone |
| Drifting from your decisions | The Decision Register in every briefing and review |
| Silent quality decline | The daily health report compares checker counts with yesterday |
