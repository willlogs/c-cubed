// Default project settings, before command-center.json overrides them.
// Every project-specific value the kit reads starts here.

/** Project settings file, at the main checkout's root. */
export const CONFIG_FILE = "command-center.json";

/** Where the kit lives inside a project. */
export const KIT_FOLDER = "tools/command-center";

/**
 * Settings used when command-center.json leaves them out.
 *
 * Objects merge key by key; arrays and null replace.
 */
export const DEFAULTS = {
  // Who the project is and who decides for it.
  project: "",
  owner: "",
  port: 8095,

  // Trunk takes every pull request; the others are optional.
  branches: { trunk: "main", staging: null, production: null },
  decisions: "vault/00-direction/Decision Register.md",

  // Workers, their worktrees, and the gate their work passes.
  workers: { max: 10, model: "sonnet" },
  worktrees: { setup: [], lockfiles: ["package-lock.json"] },
  checks: [],
  enforcement: { readableCode: true, maxFolderFiles: 5, hexagonal: [] },

  // Optional per-worktree app stacks, run by project commands.
  stacks: null,

  // Optional versions: one file holds the number.
  versions: { file: null, pattern: null, changelog: "CHANGELOG.md", migrations: null },

  // Where kit updates come from.
  kit: { source: "https://github.com/willlogs/c-cubed.git", ref: "main" },
};

/** Defaults for a stacks block once a project adds one. */
export const STACK_DEFAULTS = { max: 3, ports: ["app"], start: null, stop: null, health: null, url: null };
