---
name: setup-project
description: First-run setup of the {{project}} command center. Inspects the repository, interviews {{owner}} in short rounds, records the founding decisions {{owner}} accepts, writes command-center.json, AGENTS.md, and the vault docs, wires the enforcement checkers, creates the GitHub labels, and finishes with npm run cc -- setup done. Use when the session was started by npm run command-center in setup mode, or {{owner}} asks to set up, re-run setup, or onboard a project to the command center.
---

# Set up the project

The command center runs every later agent from the rules you write now. A wrong default here costs more than a slow question, so ask. A missing rule costs more than a long interview, so cover every step. Everything you record must trace to {{owner}}'s words.

## Ground rules

- **{{owner}} decides.** Record only what {{owner}} said or accepted. A default nobody accepted is an open question, written to `vault/00-direction/Open Questions.md`, never a setting.
- **Read before you ask.** Each question carries your recommendation, based on what the repository already shows.
- **One question per choice.** Recommendation first, two to four options, and whether before how. Use the AskUserQuestion tool when it is available. Never bundle unrelated choices.
- **Merge, never replace.** Existing `AGENTS.md`, `CLAUDE.md`, docs, and CI stay. Add what is missing, and show {{owner}} any conflict before resolving it.
- **Ask yes or no before anything that leaves this machine:** labels, a new repository, a push, or a pull request.
- **Stay in setup.** Write no product code, start no workers, merge nothing.

## Steps

### 1. Inspect the repository

Find, without asking: languages and package managers, lockfiles, scripts (`package.json`, `Makefile`, `pyproject.toml`), test and lint tools, existing `AGENTS.md`, `CLAUDE.md`, and docs, CI files, deploy files (Dockerfile, compose, platform configs), the git remote, the default branch, and other long-lived branches. Read `command-center.json`, which the installer wrote with its first guesses.

Summarize what you found for {{owner}} in ten lines or fewer before the first question.

### 2. Interview in rounds

Follow [references/interview.md](references/interview.md). Rounds, in order:

1. Product and goal.
2. Stack and repository map.
3. Branches, environments, and what counts as production or sensitive.
4. Commands: install, test, typecheck, lint, build.
5. Running the app per worker (stacks), if workers need it.
6. Versions and releases.
7. Architecture: module boundaries, enforcement, and extra rules.

After each round, say in one line what you will record.

### 3. Settle the founding decisions

`{{decisions}}` holds a **Proposed at setup** table. Walk {{owner}} through it in small groups. For each row, {{owner}} accepts, edits, or rejects it.

- Move accepted rows to the **Accepted** table, numbered D01, D02, and so on in order. Set the source to `Setup interview <YYYY-MM-DD>` and keep {{owner}}'s edits in their words.
- Drop rejected rows. Put any that need more thought in Open Questions.
- Add the project decisions from the interview the same way: one row each, with an **Enforced by** entry.
- Delete the Proposed table when it is empty.

**Enforced by** names what stops a violation: a checker in `npm run cc -- check`, the guard hook, a permission deny in `.claude/settings.json`, or `review`. When only review guards something important, offer {{owner}} an issue to build a checker for it.

### 4. Write the files

Follow [references/files.md](references/files.md): `command-center.json`, every `<!-- setup: … -->` placeholder in `AGENTS.md` and the vault docs, and the permission denies {{owner}} named. Leave no placeholder behind; a section {{owner}} chose to skip says so in one line.

Then re-render the kit's files with the new settings:

```bash
npm run cc -- render
```

### 5. GitHub

- **Repository:** if there is no remote, ask whether to create one. Only on a yes, run `gh repo create` with the name and visibility {{owner}} chose.
- **Labels:** ask yes or no, then run `npm run cc -- labels`.

### 6. Baseline check

Run the gate once and report the result to {{owner}}:

```bash
npm run cc -- check
```

Existing code is legacy: findings there are hidden in change mode, and workers fix them only where they touch it. Report the counts so the daily health report has a starting point. A failing project check (tests, typecheck) is a finding for {{owner}}, not something to fix during setup.

### 7. Commit

Commit on `{{trunk}}` in this checkout, only after {{owner}}'s yes. The command center runs from these files, so never switch this checkout to another branch.

- **Pushing:** the guard blocks agents from pushing `{{trunk}}`. Ask {{owner}} to push it with `! git push -u origin {{trunk}}`.
- **Protected trunk on GitHub:** instead push the same commit as `setup-command-center` (`git push origin HEAD:refs/heads/setup-command-center`) and open a pull request after {{owner}}'s yes. Ask {{owner}} to merge it with a merge commit, never a squash, so `git pull --ff-only` keeps this checkout on `{{trunk}}`.

Commit `command-center.json`, `AGENTS.md`, the vault docs, `.github/`, `.claude/`, `.agents/`, the root scripts, and `{{kitFolder}}` (without `node_modules`).

### 8. Finish

```bash
npm run cc -- setup done
```

It checks the settings, the placeholders, and the register, then replaces you with the assistant and starts the master. Setup is done whenever those files are complete, so a fresh clone starts normally. If it reports something missing, fix that and run it again. Tell {{owner}} the command center now runs normally, and that "Start the day" begins the first daily loop.
