# Files and folders

Small files in small, well-named folders let a reader find behavior by browsing instead of searching. Use this when planning new code, when a file nears 200 lines, or when a folder would gain a sixth file.

## Split by responsibility

- Give each file one job you can state in its header's first line. If the header needs "and", the file has two jobs.
- Look for these seams first: contracts and types, pure rules, orchestration, external I/O, mapping or serialization, validation, rendering.
- Treat a function with several named step comments as a candidate. Move cohesive stages into documented helpers, often in a sibling file.
- After a split, the parent orchestrates and the children never import the parent. Check for import cycles.
- Split along existing architectural layers, never across them. A subfolder inside `application/` is still application code.

## When a folder would hold a sixth file

Group by sub-capability, not by file type. Choose names a teammate would guess.

Before, with six files:

```text
sync/
├── boardSync.ts
├── boardSyncQueue.ts
├── boardSyncWorker.ts
├── itemSync.ts
├── itemSyncMapping.ts
└── syncErrors.ts
```

After, with no folder over five files and shorter names because the folder carries context:

```text
sync/
├── errors.ts
├── boards/
│   ├── sync.ts
│   ├── queue.ts
│   └── worker.ts
└── items/
    ├── sync.ts
    └── mapping.ts
```

Avoid catch-all subfolders such as `misc/`, `helpers/`, or `other/`. Those move the problem instead of naming it.

## Naming

- Name for the capability or role: `refreshLock.ts`, `boardMapping.ts`, `routes.ts`.
- Let folders carry shared context so file names stay short: `boards/queue.ts`, not `boards/boardQueue.ts`.
- Mirror names already used nearby, such as `api.ts`, `model.ts`, `hooks.ts`, and `ui/`.
- Never create empty folders to make a tree look complete.

## Oversized legacy files

- Never make an oversized file bigger. In change mode the checker flags growth past 200 or 300 lines.
- When your change touches one responsibility of a large file, extract that responsibility into a new file if it is safe and in scope.
- When a safe split needs a broader redesign, finish the requested change without growing the file. Then report the needed split and propose its shape.
- Never rewrite unrelated code only to quiet the checker.

## Response-only code

Count lines in code you show without writing to disk. A block presented as one file follows the same 300-line ceiling, and a requested module is shown as a folder of files.
