---
name: write-readable-code
description: Enforces whitespace-forward, fully documented code with two-line file headers, hover-card docs (summary, Purpose, every input, output) on every function, one-line step comments, comment lines of ten words or fewer, three blank lines between functions, files under 300 lines, and folders of five files or fewer. Use whenever you create, edit, refactor, generate, or review handwritten code in any language (TypeScript, React, Python, scripts, tests), including one-function fixes, and before handing off any code change. Also use when the user asks for readable, documented, commented, smaller, or better-organized code. Ships a checker that reports only findings inside your change.
---

# Write Readable Code

Code is read far more often than it is written: by the user reviewing changes from many agents, by the next agent, and through editor hover cards. These rules make every file explain itself on first pass. A header says why the file exists. Every function shows a complete hover card. Step comments give each body a scannable outline. Whitespace separates subjects, and small files live in small, well-named folders.

## Precedence

Correctness, the user's request, repository instructions (AGENTS.md, CLAUDE.md), language grammar, and formatter output come first. Inside those bounds these rules are mandatory. If one genuinely conflicts, name the conflict before writing code, or at handoff if validation reveals it. Never relax a rule quietly.

- Leave generated, vendored, lock, and machine-owned files alone; document their handwritten owners instead. Never add comments to formats that forbid them.
- In legacy code, everything you write follows the rules and untouched code keeps its style. When you edit a declaration, fix its local findings, such as a missing `Purpose:` line or step comment. Don't restructure unrelated code just to silence the checker.

## Workflow

1. Read repository instructions and the files around your change.
2. Plan files before code: one explainable job each, about a 180-line budget, at most five files per folder. A requested "module" is a folder, not one file.
3. Write the header, hover card, and step comments while writing each function, not in a cleanup pass.
4. Split a responsibility out before any file reaches 200 lines.
5. Format and test with the repository's normal commands.
6. Run the checker on your change and fix what it reports.
7. Walk the handoff checklist.

## The rules

**File header.** Open every handwritten file with two or three short comment lines: what the file is responsible for, why it exists as a separate file, and optionally one boundary constraint. Place it after any required shebang, license, encoding line, or directive. In TypeScript use `//` lines rather than `/** */`, because a JSDoc block directly above an undocumented declaration becomes that declaration's hover card.

**A hover card on every function.** Document every function, method, constructor, accessor, hook, handler, component, fixture factory, and local helper with the language's documentation syntax (JSDoc, docstrings, `///`, XML docs) so editors show it on hover. Each card has:

- a one-line summary;
- a separate `Purpose:` line saying why the function exists;
- every input (`@param name …` or `Inputs:` entries), or an explicit `Inputs: None.`;
- the output (`@returns …` or `Output:`), with `No value.` for void;
- `Side effects:` when a call changes anything beyond its return value.

Describe meaning, not the types the signature already shows. Separate sections with blank comment lines, because hover cards merge consecutive plain lines into one paragraph. Classes, exported types, interfaces, and enums need at least a summary line. Trivial inline callbacks, like `boards.map((board) => board.id)`, and object-literal members that forward to a documented interface may stay inline without a card. Once an inline function holds real logic, extract it into a named, documented function.

**Step comments.** Every non-empty function body gets at least one comment, and every major step gets a one-line comment directly above it. A step comment says what the next block does and why, naming key data passed between steps. It never narrates syntax or restates the code. Several named steps in one function signal an extraction: move cohesive stages into documented helpers.

**Short comment lines.** Keep every comment line to ten words or fewer, including doc lines, tags, and continuations. Wrap a longer thought across lines, or better, say less. Tool directives such as `eslint-disable` and `@ts-expect-error` are exempt, and a URL counts as one word.

**Whitespace.** Leave three blank lines between adjacent functions, methods, and classes. Leave four between major top-level subjects, such as the imports-and-constants block and the functions below it, or the functions and a module bootstrap. Never leave more than four in a row.

**Small files.** Count physical lines, including comments and blanks. Budget new files around 180 lines, review splitting at 200, and treat 300 as a hard ceiling. Never create or fully rewrite a file above it, including code shown only in a response. Most feature files should land between 100 and 200 lines, but never pad a small cohesive file. Never grow a file already over the limit. Extract the responsibility you are touching when that is safe and in scope; otherwise report that the file needs a split.

**Small folders.** Keep at most five files per folder. When a sixth would arrive, group related files into named subfolders by responsibility. Project roots whose files are dictated by tooling (those holding package.json, tsconfig.json, pyproject.toml, and similar) are exempt.

**Names.** Name files and folders for capabilities and roles, so a teammate finds behavior without a global search. Avoid buckets like `misc`, `helpers`, `common`, or a sprawling `utils`. Keep strongly related files adjacent, and colocate tests the way the repository already does.

Copyable shapes, all passing the checker, are in [references/examples.md](references/examples.md). Splitting and folderizing guidance is in [references/structure.md](references/structure.md).

## Validate

The checker lives under this skill's base directory, which is `.agents/skills/write-readable-code` in this repository. `npm run cc -- check` runs it over your branch, with the architecture scanner when the project enables it. To run it directly from the repository root:

```bash
# Before handoff: files and lines changed since HEAD, plus untracked files.
python3 <skill-dir>/scripts/check_readability.py --changed

# Branch work already committed: everything since the merge-base with the trunk.
python3 <skill-dir>/scripts/check_readability.py --since origin/{{trunk}}

# Audit whole folders, legacy code included.
python3 <skill-dir>/scripts/check_readability.py src
```

Add paths to narrow change mode, as in `--changed src/client`. Exit codes are 0 for clean, 1 for errors, and 2 for a git or setup failure.

In change mode, findings in code you wrote print plainly. Findings in legacy declarations you edited end with `(touched legacy code)`. Pre-existing findings elsewhere are hidden and counted in the summary. Fix every plain finding. Fix touched findings when the fix is local; otherwise list them in your handoff.

The TypeScript rules need the `typescript` package. The checker looks for it near the files, then in the main checkout when you are in a git worktree without `node_modules`, then globally. A `setup/typescript` error means the TypeScript rules did not run, so the check fails; rerun with `--typescript <folder-with-node_modules>`.

| Rule | Meaning | Fix |
|---|---|---|
| `comment/file-header` | Header missing or not two to three lines | Add responsibility and justification lines |
| `doc/missing` | Function, class, or exported type lacks docs | Add a hover card in the examples' shape |
| `doc/sections` | Card lacks summary, `Purpose:`, a `@param`, `Inputs: None.`, or `@returns` | Add exactly the listed sections |
| `doc/merged-lines` (warning) | Two statements on consecutive doc lines | Separate them with a blank ` *` line |
| `comment/step` | Body has no step comment (warning for long inline callbacks) | Add a one-line comment above the first step |
| `comment/words` | Comment line over ten words | Shorten or wrap it |
| `layout/function-spacing` | Fewer than three blank lines between functions | Add blank lines above the doc comment |
| `layout/blank-run` | More than four blank lines in a row | Remove the extras |
| `size/split-review` (warning), `size/file-lines` | File over 200 or 300 lines | Split by responsibility |
| `structure/folder-files` | Folder holds more than five files | Group into named subfolders |

The checker is a guardrail, not proof. It cannot judge whether a comment explains intent, whether a name reveals its role, or whether a split follows responsibility, so check those yourself.

## Handoff checklist

- Every new file opens with a two- or three-line responsibility header.
- Every new function has a summary, `Purpose:`, every input or `Inputs: None.`, and its output.
- Every non-empty body has step comments at its major steps.
- No comment line exceeds ten words.
- Functions sit three blank lines apart, and major subjects four.
- No created or rewritten file exceeds 300 lines, and anything over 200 was deliberately reviewed.
- No folder you added files to holds more than five files.
- File and folder names reveal where behavior lives.
- `--changed` shows no plain findings, and touched findings are fixed or listed.
- Formatting, typecheck, and tests pass.
