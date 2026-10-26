# Files setup writes

Write only what {{owner}} said. Keep each file short; agents read them on every task.

## command-center.json

The installer created it with guesses. Replace the guesses with {{owner}}'s answers, and leave keys {{owner}} did not settle at their defaults. Every key and its default is described in `{{kitFolder}}/docs/configuration.md`. An example for a Node project with a production branch:

```json
{
  "project": "Acme",
  "owner": "Sam",
  "branches": { "trunk": "main", "staging": null, "production": "production" },
  "worktrees": { "setup": ["npm ci"], "lockfiles": ["package-lock.json"] },
  "checks": [
    { "name": "typecheck", "run": "npm run typecheck" },
    { "name": "test", "run": "npm test" }
  ],
  "enforcement": { "readableCode": true, "maxFolderFiles": 5, "hexagonal": ["apps/api"] },
  "stacks": null,
  "versions": { "file": "package.json", "pattern": "\"version\": \"([^\"]+)\"", "changelog": "CHANGELOG.md", "migrations": null }
}
```

Setup ends when nothing is missing: `npm run cc -- setup done` checks the files, never a flag.

## AGENTS.md

- The block between `<!-- command-center:rules:start -->` and `<!-- command-center:rules:end -->` belongs to the kit. Never edit it; `npm run cc -- render` refreshes it.
- Replace each `<!-- setup: … -->` placeholder with what {{owner}} said, in plain short sentences.
- If the project had rules before, keep them under **Project rules** and point out conflicts with the kit block to {{owner}}.
- If a `CLAUDE.md` exists, keep it as a one-line pointer to `AGENTS.md` once its rules are merged, after {{owner}}'s yes.

## The Decision Register

`{{decisions}}` has four columns:

```markdown
| ID | Decision | Consequence | Enforced by |
| --- | --- | --- | --- |
| D01 | Every change reaches `main` through a reviewed pull request (Setup interview 2026-10-26) | No direct pushes; no other long-lived branches | guard hook, permission deny |
```

- One row per decision, in {{owner}}'s words, with its source in the Decision cell.
- Consequence holds only what {{owner}} stated, or `—`.
- Enforced by names a checker (`cc check: readable-code`, `cc check: hexagonal`, `cc check: <check name>`), `guard hook`, `permission deny`, or `review`.

## Vault docs

- `vault/00-direction/Product Direction.md`: the product, its users, the next goal, and what must never break.
- `vault/00-direction/Open Questions.md`: every choice {{owner}} left open, one line each with the setup date.

## .claude/settings.json

The kit merges its own hooks, status line, and permissions into this file on install and update, and keeps your entries. Add the project's own denies for production and sensitive commands {{owner}} named, such as a deploy CLI or a production migration command. Keep them as exact command prefixes: `"Bash(fly deploy:*)"`.
