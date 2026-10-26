# TypeScript DDD and hexagonal architecture

## Contents

- Contract direction
- Annotated examples: driver, implementation, driven port, adapter, composition
- Layer permissions
- Infrastructure placement
- Prohibited shortcuts
- Testing

## Contract direction

A driver is a capability a module offers. Define it in the provider's `domain/driver.ts` and implement it in the provider's application layer.

A driven port is a capability a module needs. Define it in the consumer's `domain/driven.ts` and implement it in the consumer's `adapters/` folder.

The consumer owns translation because it owns the meaning it needs. The provider never learns the consumer's vocabulary, so one provider can serve many consumers without changing.

## Annotated examples

The flow below crosses one boundary: operations needs data the cache module owns. Only `operations/adapters/cache.ts` touches both modules, and composition constructs and connects everything.

Provider driver, in `cache/domain/driver.ts`. It re-exports the types consumers need, because adapters may import only this file:

```ts
// Defines cache capabilities offered outside its boundary.
// Keeps cache application details private.

import type { CacheRequest, CacheResult } from './types';

export type { CacheRequest, CacheResult } from './types';



/**
 * Offers cache operations to composed consumers.
 *
 * Purpose: Publish cache-owned application capabilities.
 */
export interface CacheDriver {
  readOperation(input: CacheRequest): Promise<CacheResult>;
}
```

Provider implementation, in `cache/application/cacheDriver.ts`:

```ts
// Implements the cache module's public driver.
// Keeps business behavior inside cache application ownership.

import type { CacheDriver } from '../domain/driver';
import type { CacheStorePort } from '../domain/driven';



/** Dependencies required by cache application behavior. */
export interface CacheDriverDependencies {
  store: CacheStorePort;
}



/**
 * Builds the cache module's public driver.
 *
 * Purpose: Bind cache behavior to required ports.
 *
 * @param dependencies Cache capabilities supplied by composition.
 * @returns Cache capabilities exposed to composed consumers.
 */
export function createCacheDriver(dependencies: CacheDriverDependencies): CacheDriver {
  // Implement the public contract through local behavior.
  return {
    readOperation: async (input) => dependencies.store.read(input),
  };
}
```

Consumer port, in `operations/domain/driven.ts`, using only operations vocabulary:

```ts
// Defines capabilities required by operations.
// Uses only operations-owned domain language.

import type { OperationCacheResult, OperationRequest } from './types';



/**
 * Supplies cache behavior required by operations.
 *
 * Purpose: Invert the dependency on the cache module.
 */
export interface OperationsCachePort {
  read(input: OperationRequest): Promise<OperationCacheResult>;
}
```

Consumer adapter, in `operations/adapters/cache.ts`, with larger mapping code in `operations/adapters/cache/`:

```ts
// Adapts cache capabilities into operations language.
// Owns every translation across this context edge.

import type { CacheDriver } from '../../cache/domain/driver';
import type { OperationsCachePort } from '../domain/driven';
import { mapCacheResult, mapOperationRequest } from './cache/mapping';



/**
 * Builds the operations-owned cache adapter.
 *
 * Purpose: Translate operations needs into cache calls.
 *
 * @param cache Public cache capability supplied by composition.
 * @returns Cache port expressed in operations language.
 */
export function createOperationsCacheAdapter(cache: CacheDriver): OperationsCachePort {
  // Translate both directions at the bounded-context edge.
  return {
    read: async (input) => mapCacheResult(await cache.readOperation(mapOperationRequest(input))),
  };
}
```

Composition root, in `src/composition.ts`:

```ts
// Constructs the application's complete dependency graph.
// Keeps module wiring explicit and centralized.

import { database } from './infrastructure/database';
import { createCacheStoreAdapter } from './modules/cache/adapters/store';
import { createCacheDriver } from './modules/cache/application/cacheDriver';
import { createOperationsCacheAdapter } from './modules/operations/adapters/cache';
import { createOperationsDriver } from './modules/operations/application/operationsDriver';

// Build the provider's store adapter and public driver.
const cacheStore = createCacheStoreAdapter(database);
export const cache = createCacheDriver({ store: cacheStore });

// Translate the provider driver into consumer language.
const operationsCache = createOperationsCacheAdapter(cache);
export const operations = createOperationsDriver({ cache: operationsCache });
```

When this file nears 300 lines, move sub-graphs into functions under `src/composition/` that take their dependencies and return drivers. `composition.ts` then calls them in order, keeping the graph readable top to bottom.

## Layer permissions

| Source | May import |
|---|---|
| `core/` | `core/`, packages |
| Root `infrastructure/` | `core/`, generated clients, root `infrastructure/`, packages |
| Module `domain/` | Own `domain/`, shared contract packages |
| Module `application/` | Own `domain/` and `application/`, `core/`, shared contract packages |
| Module `adapters/` | Own `domain/`, `adapters/`, `infrastructure/`; root `infrastructure/`; generated clients; `core/`; packages; other modules' `domain/driver.ts` |
| Module `infrastructure/` | Own `domain/` and `infrastructure/`, generated clients, `core/`, packages |
| Module `interface/` | Own `domain/driver.ts`, own `interface/`, `core/`, packages |
| `composition.ts` and `composition/` | Every constructor and contract needed for wiring |
| `index.ts` | Composition exports, interfaces, core lifecycle |

Only an adapter may import another module, and only that module's `domain/driver.ts`. When consumers need a type defined deeper in the provider's domain, re-export it from the provider's `driver.ts`.

Top-level `adapters/<capability>.ts` files each implement a driven port. Larger mapping and support code for one adapter lives in `adapters/<capability>/`.

## Infrastructure placement

Root infrastructure owns application-wide external clients: database handles, Redis connections, HTTP clients, clocks, identifiers, and configuration-backed SDK clients. It holds no business rules and imports no modules.

Module infrastructure owns technology-specific runtime that belongs to one bounded context, such as its queue worker or webhook runtime. It stays behind that module's adapters and never becomes another module's dependency.

## Prohibited shortcuts

- Importing foreign domain entities for convenience.
- Publishing application service implementations.
- Instantiating adapters inside application services.
- Configuring ports through mutable module globals or setters.
- Resolving dependencies through a container inside business code.
- Creating one universal shared-domain folder.
- Letting persistence models become domain models.
- Passing provider DTOs through a consumer unchanged.
- Calling foreign drivers directly from consumer application code.
- Placing cross-module orchestration outside composition.

## Testing

- Test domain and application behavior with fakes of the module's own driven ports, written in that module's language.
- Test each adapter separately for mapping and delegation, using a fake of the provider driver.
- Smoke-test composition by constructing the complete object graph.
- Never import another module's test fixtures into a module unit test. Shared integration fixtures live outside module test folders.
