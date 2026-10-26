# Dispatching workers

Workers are separate Claude sessions using the `issue-worker` agent (`.claude/agents/issue-worker.md`). Write the briefing below to a file, then start the worker. The server creates its worktree in `{{worktrees}}/` and shows the session in the UI:

```bash
npm run cc -- spawn <issue> <short-slug> --model sonnet --brief-file /tmp/brief-<issue>.md
npm run cc -- sessions                         # who runs, idle time, exits
npm run cc -- send <name> "<instruction>"      # steer a worker
npm run cc -- screen <name> --lines 40         # read its recent output, sparingly
npm run cc -- stop <name> --forget             # end it after merge
```

Workers report by queueing messages to you: they start with `[issue-<n>]`. {{owner}} may also type into your session directly.

## Choosing the model

| Work | Model | Why |
|---|---|---|
| S issue, or M with clear criteria and an existing pattern to follow; no risk label | Sonnet | Fast and cheap; the review catches misses |
| `risk:schema`, `risk:contracts`, or anything touching production | Opus | Mistakes outlive the PR |
| New module, new ports, cross-module flow, or a design-heavy issue | Opus | Architecture judgment |
| Retry after a review showed Sonnet misunderstood | Opus | Escalate on judgment, not failure counts |
| Triage, summaries, log reading | You, or Haiku when bulky | Cheap |

Escalate as soon as a review shows the approach is wrong. Do not wait for repeated check failures. Small fixes you can describe go back to the same worker with `npm run cc -- send`, or you make them yourself.

## Running workers in parallel

- Run as many workers as the module locks allow, up to the command center's cap of {{maxWorkers}} (`workers.max` in `command-center.json`). The usage limits in the skill still apply.
{{#if hasStacks}}- Stacks are capped separately (`stacks.max`). Workers write code and run `npm run cc -- check` first, and start a stack only for their live check.
{{/if}}- Lock modules, not issues: an issue may touch several modules. Before dispatching, list every module it touches; those are locked for that worker's run. Two running workers never share a module, a shared contract, a database schema, or a composition root.
- A feature that crosses modules is still one issue and one PR when it fits one session and one careful review; lock every module it touches. When it must split, split by outcome, and put a shared contract or schema in the first part. Each part starts from `{{trunk}}` after the previous one merges, so parts connect through what is already there.
- Run `risk:schema` and `risk:contracts` issues alone.
- Dispatch dependent issues only after their prerequisite merges, so each starts from current `{{trunk}}`.

## Worker briefing

Workers know only what you write. Fill this in every time:

```text
Issue: #<number> <title>  (read it with: gh issue view <number> --comments)
Branch and worktree: issue-<number>-<slug>  (the server creates it)
Model choice reason: <why Sonnet or Opus>

Owned modules: <the folders this worker may change>
Do not touch: <modules other workers own right now; shared contracts unless listed>
Reuse, don't rebuild: <existing helpers, ports, components found by searching>
Decisions that apply: <D-numbers from the Decision Register, one line each>
Architecture notes: <ports to add or extend, which composition root wires them>

Definition of done: acceptance criteria hold; npm run cc -- check passes;
the PR includes the end-to-end test and UX risks{{#if hasStacks}}; the stack is stopped{{/if}}.
Report back: PR link, what changed, verification results, open questions.
```

Before writing "Reuse, don't rebuild", search for existing code (`git grep`{{#if hexagonal}}, the module's `domain/driver.ts`{{/if}}) so the worker extends what exists instead of duplicating it.
