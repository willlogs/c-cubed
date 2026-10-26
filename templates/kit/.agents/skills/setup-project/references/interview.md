# Setup interview

Ask each round in order. Every question gets your recommendation first, from what the repository shows. Skip a question only when the repository already answers it beyond doubt, and say what you found instead.

## 1. Product and goal

- What is the product, and who uses it? (one or two sentences, in {{owner}}'s words)
- What is the next goal worth shipping?
- What must never break for users?

Record in `vault/00-direction/Product Direction.md`.

## 2. Stack and repository map

- Confirm the languages, frameworks, and package manager you found.
- Confirm the top-level folders and what each holds. Monorepo apps may get their own `AGENTS.md`; ask whether.
- Are there shared contracts or types that several parts use? Who owns them?

Record in the Repo map section of `AGENTS.md`.

## 3. Branches, environments, and sensitivity

- Which branch is the trunk every pull request merges into? (recommend the current default branch)
- Is there a staging branch or environment? Whether first; its name only after a yes.
- Is there a production branch that deploys? Whether first; its name only after a yes.
- Where does production run, and what deploys it?
- Which actions count as production or sensitive? Examples to offer: deploys, production migrations, secrets and env vars, billing, deleting user data. Each one becomes a rule that needs {{owner}}'s yes, and where possible a permission deny.

Record in `branches`, the Environment and production section of `AGENTS.md`, and `.claude/settings.json` denies.

## 4. Commands

- How does a fresh checkout install dependencies? This becomes `worktrees.setup`, run in every new worktree. Name the lockfiles that should trigger a reinstall (`worktrees.lockfiles`).
- Which commands must pass before any merge: tests, typecheck, lint, build? Each becomes one entry in `checks`, run by `npm run cc -- check` and by the master's verify. Recommend only commands that exist and finish in a few minutes.
- Does any check need services (a database, a queue)? If yes, ask how agents should get them.

Record in `command-center.json` and the Commands section of `AGENTS.md`.

## 5. Running the app per worker

- Do workers need a running copy of the app to check their change? Whether first. With a no, leave `stacks` null.
- With a yes: how does one copy start and stop, which ports does it need, how do you tell it is healthy, and which URL opens it? Agree the commands with {{owner}}, then fill `stacks` as `{{kitFolder}}/docs/configuration.md` describes.
- How many copies may run at once on this machine? (recommend 3)

## 6. Versions and releases

- Should the project track versions as GitHub milestones with a release step? Whether first. With a no, leave `versions.file` null.
- With a yes: which file holds the version number, and which pattern finds it? Recommend `package.json` and its `"version"` field for Node projects. Where does the changelog live? Does a release list new database migrations, and where are they?

## 7. Architecture

Explain each enforcement layer briefly, then ask:

- **Readable code** (on by default): headers, hover-card docs, step comments, short comment lines, spacing, files under 300 lines. Keep it on?
- **Folder size:** at most five files per folder, tooling-dictated roots exempt. Keep five?
- **Hexagonal modules** for TypeScript backends: offer it only when a TypeScript backend exists. Which application roots (folders holding `tsconfig.json` and `src/composition.ts`)? Roots go in `enforcement.hexagonal`.
- **Module boundaries:** which modules exist, and which may depend on which? Write them as decisions; offer a checker issue for rules only review enforces.
- **Other rules {{owner}} holds:** naming, error handling, data handling, dependencies, tests. Each becomes a decision with an Enforced by entry.
