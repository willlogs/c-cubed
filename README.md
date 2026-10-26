# Command center

Runs a software project with a team of Claude Code sessions, in a local page that shows each one as a live terminal. The owner talks to an **assistant**; a **master** turns the owner's decisions into GitHub issues, briefs one **worker** per issue in its own worktree, verifies each pull request locally, and merges it. Every rule the agents follow lives in the project's repository, and the important ones are enforced, not just written down.

The kit installs into any git project as `tools/command-center/`. Its first run is a setup interview that writes the project's rules and founding decisions.

## Requirements

- Node 22 or newer, git, and Python 3 (the readable-code checker).
- [Claude Code](https://claude.com/claude-code) (`claude` on the PATH) and the [GitHub CLI](https://cli.github.com) (`gh`), logged in.
- Linux or macOS: sessions run in pseudo-terminals (`node-pty`).

## Add it to a project

From a checkout of this kit:

```bash
git clone https://github.com/willlogs/command-center.git ~/command-center
node ~/command-center/bin/command-center.mjs init path/to/project     # an existing git project
node ~/command-center/bin/command-center.mjs new path/to/new-project  # or start a new one
```

`init` asks for the owner and project name (`--yes` takes the defaults: `git config user.name` and the folder name) and detects the trunk, install command, and checks. Then:

```bash
cd path/to/project
npm run command-center    # http://127.0.0.1:8095
```

## First run: setup

Until setup is done, only the assistant runs, as the setup interviewer. In a new folder Claude Code first asks whether you trust it; answer in the Sessions tab, then press **Start setup**. The interviewer:

1. Reads the repository, so every question comes with a recommendation.
2. Interviews the owner one question at a time: product, stack, branches and production, commands, per-worker app stacks, versions, and architecture.
3. Walks the owner through the **founding decisions** the kit proposes (one trunk, the owner decides, verify before merge, readable code, five files per folder, hexagonal TypeScript backends where they exist, and more). Only accepted ones enter the Decision Register, as D01, D02, and so on, each naming what enforces it.
4. Fills `command-center.json`, the project sections of `AGENTS.md`, and the vault docs; creates the GitHub labels after a yes; runs the gate once for a baseline; commits after a yes.
5. Runs `npm run cc -- setup done`, which checks nothing is missing and switches to the assistant and the master.

Setup is done whenever those files are complete, so teammates who clone the repository start in the normal mode.

## How decisions are enforced

| Layer | What it stops |
|---|---|
| `npm run cc -- check` | The gate: the project's own `checks`, then the readable-code checker (headers, hover docs, comment length, file size, five files per folder) and, per configured root, the hexagonal-modules scanner. Workers run it before a PR. |
| `npm run cc -- verify <pr>` | The master merges only after this: the PR merged with its current base, in a separate worktree, through the whole gate. It records a `local verify` commit status and a PR comment. |
| Guard hook | Every Claude session in the project: no `gh pr merge` without a passing `local verify` on the PR's head, no Claude merges into production, no pushes to trunk, staging, or production, no force pushes. Sessions inside the command center also cannot stop it. |
| `.claude/settings.json` | Permission denies for the same pushes, plus allows for routine commands so workers run in auto mode. |
| Review | The master reviews every PR against the Decision Register; PRs touching schema, auth, production config, removals, or new modules wait for the owner. |

## Daily use

See [docs/daily-use.md](docs/daily-use.md): the daily loop, the page's tabs (Home, Sessions, Map, Progress, Versions, Status), and talking to the assistant.

## Settings

See [docs/configuration.md](docs/configuration.md) for every key in `command-center.json`, including per-worktree app stacks and versions.

## Update

```bash
npm run cc -- update                        # from kit.source at kit.ref
npm run cc -- update --from ~/command-center  # from a local checkout
```

The new kit's own installer runs. It replaces only what the kit owns and never touches the project's files.

| Owner | Files |
|---|---|
| Kit, replaced on update | `tools/command-center/`, `.claude/agents/{assistant,issue-worker,setup}.md`, `.agents/skills/{command-center,work-on-issue,setup-project,write-readable-code,enforce-ts-hexagonal-modules}/`, the `.claude/skills/` links, and the rules block between the `command-center:rules` markers in `AGENTS.md` |
| Merged, project entries kept | `.claude/settings.json` (kit hooks, status line, and permissions), root `package.json` scripts (`command-center`, `cc`, `status`, `instances`), `.gitignore` |
| Project, written once | `command-center.json`, the rest of `AGENTS.md`, the Decision Register, `Product Direction.md`, `Open Questions.md`, `.github/pull_request_template.md` |

## Commands

```bash
npm run command-center                 # the page and the sessions; Ctrl-C stops everything
npm run cc -- check                    # the gate, in the current checkout
npm run cc -- verify <pr>              # the gate on a PR merged with its base
npm run cc -- sessions|spawn|send|queue|interrupt|screen|stop
npm run cc -- version [new|add|ship]   # versions as GitHub milestones
npm run cc -- labels|render|update|setup done
npm run instances -- new|checkout|up|down|logs|remove|status <name>
npm run status                         # stacks, versions, plan, PRs, usage
```

## This repository

| Folder | Holds |
|---|---|
| `bin/` | `init`, `new`, and `update`, with prompts and the summary printer |
| `install/` | Copying the kit, rendering templates, merging settings, scripts, and `AGENTS.md`, and detecting a project's commands |
| `templates/` | `kit/` files the kit owns, `project/` files written once, `blocks/` the AGENTS.md rules block |
| `config/` | Reading `command-center.json`, paths and state, and when setup is done |
| `server/` | The HTTP and WebSocket server: sessions in pseudo-terminals, the queue, setup mode, and the Map, Progress, and Status data |
| `ui/` | The page |
| `cli/` | `cc`, `status`, the status line, `check`, `verify`, labels, and versions |
| `instances/` | Worktrees per agent and the project's stacks |
| `versions/` | Versions from GitHub milestones: numbers, stages, changelog, and release steps |
| `hooks/` | The activity recorder and the guard |
| `docs/` | Daily use and configuration |

Work on the kit itself:

```bash
npm install
npm test                                                     # node --test
python3 templates/kit/.agents/skills/write-readable-code/scripts/check_readability.py bin cli config hooks install instances server ui versions --typescript .
COMMAND_CENTER_PORT=8096 node server/main.mjs --no-master --no-open   # try the page beside a live one
```

The kit started as ActionLink's command center (`actionlink` at `65eb6c387`).
