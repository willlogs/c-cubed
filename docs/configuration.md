# Configuration

Each project keeps its settings in `command-center.json` at the root of its main checkout. `init` writes a first guess; the setup interview replaces the guesses with the owner's answers. Leave out any key whose default fits. Objects merge with the defaults key by key; arrays and `null` replace them.

The running command center rereads the file whenever it changes. After changing anything that kit files mention (owner, project, branches, decisions path, enforcement), run `npm run cc -- render` so skills, agents, and the AGENTS.md rules block say the same thing.

## Keys

| Key | Default | Meaning |
|---|---|---|
| `project` | `""` | Name shown in the page title and in rules. |
| `owner` | `""` | The person who decides. Rules, prompts, and the page use this name. |
| `port` | `8095` | Local port of the page and API. `COMMAND_CENTER_PORT` overrides it for one run. |
| `branches.trunk` | `"main"` | The branch every pull request merges into. |
| `branches.staging` | `null` | Optional staging branch. Protected from direct pushes when set. |
| `branches.production` | `null` | Optional production branch. When set, versions ship through a promotion PR the owner merges, and the guard refuses Claude merges into it. |
| `decisions` | `"vault/00-direction/Decision Register.md"` | The Decision Register. The Map, Progress, and setup read it. |
| `workers.max` | `10` | Workers allowed at once. `COMMAND_CENTER_MAX_WORKERS` overrides it. |
| `workers.model` | `"sonnet"` | Default worker model: `sonnet`, `opus`, or `haiku`. |
| `worktrees.setup` | `[]` | Shell commands run in every new worktree, such as `npm ci`. |
| `worktrees.lockfiles` | `["package-lock.json"]` | Files whose change means setup must run again. |
| `checks` | `[]` | The project's own gate: `[{ "name": "tests", "run": "npm test" }]`. `cc check` and `cc verify` run them in order. |
| `enforcement.readableCode` | `true` | Runs the readable-code checker on every change. |
| `enforcement.maxFolderFiles` | `5` | Files allowed per folder. Tooling roots are exempt. |
| `enforcement.hexagonal` | `[]` | TypeScript backend roots (each with `src/composition.ts`) that the hexagonal scanner checks. Empty turns it off and leaves the skill out. |
| `stacks` | `null` | Optional app stack per worktree. See below. |
| `versions.file` | `null` | File holding the version number. `null` turns versions off. |
| `versions.pattern` | `"version":\s*"([^"]+)"` | Regular expression whose only group captures the number. The default fits `package.json`. |
| `versions.changelog` | `"CHANGELOG.md"` | Where release notes go, newest first. |
| `versions.migrations` | `null` | Glob of migration files to list in promotion PRs, such as `apps/*/prisma/migrations/*/migration.sql`. |
| `kit.source` | the kit's GitHub SSH URL | Where `cc update` fetches the kit. A local path or an HTTPS URL works too. |
| `kit.ref` | `"main"` | Branch or tag `cc update` uses. |

## Stacks

A stack is one running copy of the app for one worktree, so a worker or the owner can try a branch. Leave `stacks` out when workers never need a running app; the Status tab then manages worktrees only.

```json
"stacks": {
  "max": 3,
  "ports": ["app", "api"],
  "start": "docker compose -p cc-{name} -f compose.dev.yml up -d",
  "stop": "docker compose -p cc-{name} -f compose.dev.yml down",
  "health": "curl -fsS http://127.0.0.1:{port.api}/health",
  "url": "http://127.0.0.1:{port.app}/",
  "logs": "docker compose -p cc-{name} logs --tail 200"
}
```

| Key | Meaning |
|---|---|
| `max` | Stacks allowed at once (default 3). |
| `ports` | Names of the ports each stack gets. The kit picks a free block of ten from 4100 up, one port per name, and keeps it while the stack runs. |
| `start` | Starts the stack. With `stop` set, it must return once the stack runs (like `docker compose up -d`). Without `stop`, it may run forever (like `npm run dev`): the kit runs it in the background, logs its output, and stops its whole process group. |
| `stop` | Optional. Stops a stack that `start` left running. |
| `health` | Optional. Exits 0 when the stack answers. Without it, the first port must accept connections. |
| `url` | Optional. The link Status shows. |
| `logs` | Optional. Shows output; without it, `npm run instances -- logs <name>` tails the kit's log of a background start. |

Every command runs in the stack's worktree with these placeholders and variables:

| Placeholder | Variable | Value |
|---|---|---|
| `{name}` | `CC_INSTANCE` | Stack name, the same as its worktree, such as `issue-42-board-picker`. |
| `{worktree}` | `CC_WORKTREE` | The worktree's absolute path. |
| `{port.app}` | `CC_PORT_APP` | The port named `app`; one per name in `ports`. |
| | `PORT` | The first named port, for simple apps. |

## State

Activity, plan usage, and stack records live in `.git/command-center/` of the main checkout. Every worktree shares it, and deleting the repository deletes it.
