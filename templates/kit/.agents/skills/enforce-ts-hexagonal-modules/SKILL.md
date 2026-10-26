---
name: enforce-ts-hexagonal-modules
description: Enforces strict DDD and hexagonal (ports-and-adapters) boundaries in modular TypeScript backends. Each module offers capabilities in domain/driver.ts, declares needs in domain/driven.ts, crosses module boundaries only through its own adapters, and is constructed only in composition.ts. Use whenever you create, change, move, review, or refactor TypeScript backend code under src/modules, src/core, src/infrastructure, or the composition root, including new modules, ports, adapters, application services, routes, workers, queues, database or API clients, dependency wiring, or any call from one module into another. Also use when auditing architecture or fixing boundary violations. Ships a scanner that reports only violations inside your change.
---

# Enforce TypeScript Hexagonal Modules

Each business module is autonomous. It publishes what it offers, declares what it needs, and translates foreign concepts at its own edge, while one composition root wires everything in plain sight. The payoff is that a module's internals can change without touching consumers, tests use fakes written in the module's own language, and anyone can read the whole object graph in one place.

Apply the `write-readable-code` skill to everything you write here as well.

## Precedence

Repository instructions win where they differ from this skill. Name the difference instead of silently dropping a rule. Express sanctioned exceptions as scanner flags such as `--allow-package`, never by editing or weakening the scanner.

## Workflow

1. Read repository instructions. Find the application root, the folder holding `tsconfig.json` and `src/composition.ts`.
2. Identify the bounded contexts the change touches.
3. Place each piece of new code using the table below.
4. When the change adds or alters a port, adapter, module, or cross-module call, write a port plan first. Share it with the user when the design is not obvious.
5. Build inside-out: domain contracts, application, adapters, composition wiring, then interface.
6. Run the scanner on your change, then the typecheck and relevant tests.
7. Walk the completion checklist.

## Module shape

```text
src/
├── core/                  Stateless utilities; imports only core.
├── infrastructure/        App-wide external clients; no business rules.
├── modules/
│   └── <module>/
│       ├── domain/
│       │   ├── driver.ts  What this module offers.
│       │   ├── driven.ts  What this module needs.
│       │   └── <concept>.ts
│       ├── application/   Implements driver.ts using driven ports.
│       ├── adapters/      Implements driven.ts; the only cross-module importers.
│       ├── infrastructure/  Runtime technology owned by this module.
│       └── interface/     Routes, validators, serializers over the driver.
├── composition.ts         The object graph; may continue in composition/.
└── index.ts               Bootstrap and lifecycle only.
```

Create only folders that hold real files. Group files inside a layer into named subfolders, such as `application/sync/`; that never weakens layer rules.

## Where code goes

| Adding | Place it in | Constraint |
|---|---|---|
| A business rule, policy, or workflow | `<m>/application/` | Own domain, driven ports, `core/` only |
| A domain type, value, or pure calculation | `<m>/domain/` | Imports only its own domain |
| A capability other modules call | Interface in `<m>/domain/driver.ts`, implemented in `<m>/application/` | Consumers see only the interface |
| A need: database, API, queue, clock, another module | Port in `<m>/domain/driven.ts`, implemented in `<m>/adapters/<capability>.ts` | Adapter maps foreign shapes to domain shapes |
| A database, cache, or HTTP client used app-wide | `src/infrastructure/` | No business rules; never imports modules |
| A worker, queue, or webhook runtime for one module | `<m>/infrastructure/` | Reached only through that module's adapters |
| A route, socket handler, validator, or serializer | `<m>/interface/` | Calls only its own module's driver |
| A stateless helper: errors, hashing, ids, config | `src/core/` | Never imports infrastructure or modules |
| A type shared by client and server | The shared contracts package | Allowed in domain and application |
| Construction of any service, adapter, or client | `src/composition.ts` or `src/composition/` | Nowhere else |

## Port ownership

Direction means ownership, not data flow:

- `domain/driver.ts` holds what this module offers, implemented in its own `application/`.
- `domain/driven.ts` holds what this module needs, in its own vocabulary, implemented in its own `adapters/`.
- An adapter is the only file that may import another module, and only that module's `domain/driver.ts`.
- Composition connects each adapter to the driver or infrastructure it wraps.

```text
operations/application --depends on--> OperationsCachePort  (operations/domain/driven.ts)
                                            ^ implemented by
operations/adapters/cache.ts --calls--> CacheDriver         (cache/domain/driver.ts)
                                            ^ implemented by
                                  cache/application/cacheDriver.ts
```

The consumer owns translation because it owns the meaning it needs. The provider never learns consumer vocabulary.

## Non-negotiable boundaries

- `domain/` imports only its own domain.
- `application/` imports only its own domain and application, `core/`, and shared contract packages.
- Provider SDKs, database clients, queues, web frameworks, and Node built-ins stay out of domain and application. Reach them through a port and adapter, or a stateless `core/` helper.
- Application services implement driver contracts and receive only driven ports.
- `interface/` imports only its module's `domain/driver.ts`, other interface files, and `core/`. Re-export any types routes need from `driver.ts`.
- Never import another module's application, adapters, infrastructure, or interface, even for a type.
- Never share domain entities across bounded contexts; translate them in adapters.
- Construct dependency-bearing objects only in composition. No service locators, `configure*Ports` or `set*Ports` setters, mutable registries, or `container.resolve` in business code.
- Keep `index.ts` to bootstrap and lifecycle wiring.
- Persistence models never become domain models, and provider DTOs never pass through a consumer unchanged.

## Port plan

Draft this before structural edits:

```text
Change:      <one line>
Need:        <consumer> needs <capability> from <provider or system>
Driver:      <provider>/domain/driver.ts  <Driver>.<method>(<input>) -> <output>
Port:        <consumer>/domain/driven.ts  <Port>.<method>(...) in consumer terms
Adapter:     <consumer>/adapters/<capability>.ts maps <consumer> <-> <provider> shapes
Application: <service> implements <ConsumerDriver> using <Port>
Composition: build <adapter>(<provider driver>), pass it to <service>
Interface:   <route> calls <ConsumerDriver>.<method>
Tests:       fake <Port> in consumer terms; adapter mapping; composition smoke
```

Step-by-step recipes for common changes and for fixing each scanner rule are in [references/recipes.md](references/recipes.md). Layer permissions, annotated examples, and testing guidance are in [references/architecture.md](references/architecture.md).

## Validate

Run the scanner from the repository root. `<skill-dir>` is this skill's base directory, `.agents/skills/enforce-ts-hexagonal-modules` in this repository. `npm run cc -- check` runs it over your branch for every application root listed in `command-center.json` (`enforcement.hexagonal`).

```bash
# Before handoff: changes since HEAD; detects each affected application root.
node <skill-dir>/scripts/check-architecture.mjs --changed

# Branch work already committed.
node <skill-dir>/scripts/check-architecture.mjs --since origin/{{trunk}}

# Full audit of one application, legacy included.
node <skill-dir>/scripts/check-architecture.mjs --root apps/api
```

- A package whose name ends in `/contracts`, such as `@acme/contracts` or its subpaths, counts as shared contracts and is allowed in domain and application. Pass `--allow-package <name>` (repeatable) for other packages the repository sanctions.
- Composition may span `src/composition.ts` and everything under `src/composition/`, so a growing graph can be split without breaking the rules.
- The scanner works in git worktrees without `node_modules` by borrowing `typescript` from the main checkout, and prints a note when it does. Override with `--typescript <dir>`.
- Exit codes are 0 for clean, 1 for violations, and 2 for setup problems such as a missing `tsconfig.json`, composition root, or `typescript`.

In change mode, plain findings are yours, and `(touched legacy code)` marks legacy lines you edited. Pre-existing violations elsewhere are hidden and counted. Fix every plain finding. Fix touched findings when the fix is local; otherwise report them with a staged migration. Never weaken the scanner to pass.

Every run ends with a fix legend for the rules it reported:

| Rule | Fix |
|---|---|
| `boundary/cross-module` | Port in the consumer's `driven.ts`, adapter calling the provider's `driver.ts`, wired in composition |
| `boundary/layer` | Move code to the layer that may own it, or depend on a port or driver |
| `boundary/external-package` | Hide the package behind a port and adapter, or a stateless `core/` helper |
| `module/contracts` | Create `domain/driver.ts` and `domain/driven.ts` |
| `module/loose-file` | Move the file into a named layer |
| `coverage/driver` | Implement it in application, expose it via an implemented composite driver, or delete it |
| `coverage/driven` | Implement it in `adapters/<capability>.ts` and wire it, or delete it |
| `adapter/ownership` | Make the top-level adapter implement a local driven port; move helpers into `adapters/<capability>/` |
| `composition/construction` | Construct it in composition and pass it in |
| `composition/hidden-wiring` | Replace setters and locators with dependencies passed by composition |

The scanner checks structure, not meaning. It cannot tell whether a port speaks the consumer's language, whether an adapter really translates, or whether a business rule is hiding in an adapter. Review those yourself.

## Completion checklist

- Every cross-module call flows driven port, then consumer adapter, then provider driver.
- Every driven port has an adapter, and every driver an application implementation.
- Translation happens in adapters, and no foreign type reaches application code.
- Composition visibly constructs the whole object graph.
- No module imports another module's internals.
- `--changed` scanner, typecheck, and relevant tests pass.
