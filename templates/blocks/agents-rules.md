## How work happens here

This block comes from the command center kit (`{{kitFolder}}`). `npm run cc -- render` rewrites it; put project rules in the sections below it.

### Decisions are {{owner}}'s

- Every choice an issue, briefing, pull request, or Decision Register row presents as settled traces to {{owner}}: a `D` number in `{{decisions}}`, a link to {{owner}}'s words, or code already on `{{trunk}}`. Name the source.
- Anything without a source is an open question for {{owner}}, never a default. That includes product and UX behavior, scope, new tools, libraries, or services, the test approach, data handling, and cost.
- Engineering details inside a decided goal are yours: file layout, names, and tests in the frameworks already in use.
- Ask whether before how. Never raise a question that assumes something {{owner}} has not approved.
- Read `{{decisions}}` before design work. Its accepted table holds only what {{owner}} said.
- Answer questions with answers. Make no change without knowing what {{owner}} wants; suggest a fix and get a green light first. For a worker the command center started, the issue and its briefing are the request and the green light. Anything outside them goes into its report as a question, never into the change.

### Workflow

- Work arrives as GitHub issues. Follow the `work-on-issue` skill: one issue, one `issue-<number>-<slug>` branch, one worktree in `{{worktrees}}/`, one pull request into `{{trunk}}`.
- The command center (`npm run command-center`) runs {{owner}}'s assistant, the master, and the workers. The master plans the day, briefs workers, reviews, and merges into `{{trunk}}`. Follow its briefing: owned modules, decisions, and what not to touch.
- Do issue work only in your own worktree, never in the main checkout or another agent's worktree.
- Issues labeled `risk:schema` or `risk:contracts` run one at a time.

### Definition of done

- Every acceptance criterion in the issue holds.
- `npm run cc -- check` exits 0, run right before the pull request. The PR's Verification line says when, on which commit, and the result.
- Changed UI or behavior was exercised in a running copy of the app.
- The pull request template is filled, including `Closes #<number>` and risks.
{{#if hasStacks}}- Your stack is stopped.
{{/if}}

### The gate

- `npm run cc -- check` runs the project's checks from `command-center.json`, then the enforcement checkers its `enforcement` block turns on{{#if hexagonal}}, including the hexagonal scanner for {{hexagonalRoots}}{{/if}}. Plain and `(touched legacy code)` findings both fail it. When a touched finding needs work outside your issue, report it before widening the change.
- A `setup/typescript` error, a `Skipped` note, or `Checked 0 files` for code you changed means it was not checked: fix the setup and rerun.
- The master merges only after `npm run cc -- verify <pr>` passes on the exact head. A guard hook refuses `gh pr merge` otherwise, and refuses force pushes and direct pushes to protected branches.
- Never weaken a checker to make a change pass.

### Mandatory skills

Every code change follows these skills. They live in `.agents/skills/`, linked from `.claude/skills/`.

- Readable code: `.agents/skills/write-readable-code/SKILL.md`
{{#if hexagonal}}- Hexagonal modules: `.agents/skills/enforce-ts-hexagonal-modules/SKILL.md`
{{/if}}- Issue workflow: `.agents/skills/work-on-issue/SKILL.md`
- Command center (the master only): `.agents/skills/command-center/SKILL.md`

Rules in `AGENTS.md` files win when they conflict with a skill. Explain the conflict instead of silently dropping a skill rule.

### Engineering standard

- Think before changing code. Understand the affected workflow, existing abstractions, and compatibility constraints first.
- Prefer foundational, simple solutions that make the system easier to extend. Avoid clever local patches that add coupling.
- Keep modules small, explicit, and composable. Add abstractions only when they remove real complexity, protect a boundary, or match a local pattern.
- Keep files small and folderized by responsibility. **No folder holds more than five files**; group files into named subfolders. Folders whose files tooling dictates, such as a package root, are exempt.
- Document non-trivial functions, classes, exported types, and services with concise hover-card docs.
- Search for existing helpers, contracts, ports, adapters, and utilities before writing new ones. Never create a second version of something.
- If a request looks like a shallow patch for a deeper design problem, ask before coding. Name the risk and propose the smallest durable path.
- Preserve existing behavior unless the issue asks to change it. Do not rewrite unrelated areas.
- Shared contracts and data shapes are stable, typed, and owned at one boundary. Never duplicate a type a shared contract already defines.

### Production and sensitive actions

- Never push to {{#if hasProduction}}`{{production}}`{{/if}}{{#unless hasProduction}}production{{/unless}}, deploy, run production migrations, or take any other production or sensitive action without {{owner}}'s explicit yes. Ask yes or no, then run it yourself; never hand {{owner}} a command you can run.
- Development resources (worktrees, local stacks, development databases) are yours to operate.

### Rule hygiene

- Durable project rules live in this file or in a folder's `AGENTS.md`, never in hidden personal memory.
- Tool-specific files, such as `CLAUDE.md` or Cursor rules, only point here.
- Remove or ignore stale instructions that conflict with these files.
