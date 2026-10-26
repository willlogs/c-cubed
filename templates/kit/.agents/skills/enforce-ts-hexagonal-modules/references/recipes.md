# Recipes

Step-by-step paths for common changes, then a fix guide for every scanner rule. Names in angle brackets are placeholders.

## Contents

- Call another module
- Offer a new capability
- Create a module
- Add an HTTP or socket route
- Add an external client, queue, or worker
- Split a growing composition root
- Fix scanner findings

## Call another module

The consumer needs something the provider owns.

1. Find the capability in the provider's `domain/driver.ts`. If it is missing, add it first (see "Offer a new capability").
2. Declare a port in the consumer's `domain/driven.ts`, phrased in the consumer's own types and words.
3. Create `<consumer>/adapters/<capability>.ts` exporting `create<Consumer><Capability>Adapter(provider: <ProviderDriver>): <ConsumerPort>`. Map inputs into provider shapes and results back into consumer shapes. Move bulky mapping into `adapters/<capability>/mapping.ts`.
4. Add the port to the consumer application's dependencies object, and use it there.
5. In composition, build the adapter from the provider driver and pass it to the consumer's application factory.
6. Test the consumer with a fake port, and the adapter with a fake provider driver.

## Offer a new capability

1. Add the method to the module's driver interface in `domain/driver.ts`, using domain types. Re-export any types consumers need.
2. Implement it in the module's application service. Reach external systems only through driven ports.
3. If the method needs a new external capability, add a driven port and adapter (see "Add an external client, queue, or worker").
4. Composition usually needs no change, because the driver object is already wired.

## Create a module

1. Create `src/modules/<module>/domain/driver.ts` and `domain/driven.ts`. When the module needs nothing yet, `driven.ts` holds only its header.
2. Implement the driver in `application/`, as a factory that takes a dependencies object of driven ports.
3. Implement each driven port in `adapters/<capability>.ts`.
4. Wire adapters and the application factory in composition, then pass the driver to whatever exposes it.
5. Add `interface/` routes last, if the module is reachable over HTTP or sockets.
6. Create only the folders that hold files.

## Add an HTTP or socket route

1. Put the route factory in `<module>/interface/routes.ts`, taking the module driver as its only service dependency.
2. Keep validation in an interface validator file and response shaping in an interface serializer file. Route files stay thin.
3. Have the route call driver methods only. Import types through the module's `domain/driver.ts`.
4. Construct the routes in composition, or wherever the repository mounts routers, passing the driver in.

## Add an external client, queue, or worker

1. An app-wide client goes in `src/infrastructure/<system>/` with no business rules, constructed in composition.
2. A queue, worker, or webhook runtime owned by one module goes in `<module>/infrastructure/`.
3. Declare what the module needs as a driven port, then implement it in `<module>/adapters/<capability>.ts` using the client or runtime.
4. Wire client, adapter, and application in composition.

## Split a growing composition root

1. Group related wiring into functions under `src/composition/<area>.ts`. Each takes the drivers and clients it needs and returns the drivers it builds.
2. Call those functions from `composition.ts` in dependency order, so the file still reads as the whole graph.
3. Keep constructor re-export barrels free of construction. The scanner treats every file under `src/composition/` as composition.

## Fix scanner findings

- `boundary/cross-module`: one module imports another's internals. Replace the import with the "Call another module" recipe. Never fix it by importing the provider's application or adapters instead.
- `boundary/layer`: a layer imports something it may not. For example, an interface importing `../domain/types` should import a type re-exported from `domain/driver.ts`. An application importing an adapter should depend on the driven port. Domain importing application means the type belongs in domain.
- `boundary/external-package`: domain or application imports a package. For I/O, provider SDKs, frameworks, or queues, add a driven port and adapter. For pure utilities, such as hashing or identifiers, use a stateless `core/` helper. Shared contract packages the repository sanctions belong in `--allow-package`.
- `module/contracts`: create the missing `domain/driver.ts` or `domain/driven.ts`.
- `module/loose-file`: move the file into the layer matching its responsibility.
- `coverage/driver`: implement the driver in application, or delete the unused contract. A driver used only as a member of an implemented composite driver already counts as covered.
- `coverage/driven`: implement the port in `adapters/<capability>.ts` and wire it in composition, or delete the unused port.
- `adapter/ownership`: each top-level adapter file must implement a port from its own `domain/driven.ts`. Move helpers and mappers into `adapters/<capability>/`.
- `composition/construction`: a file outside composition calls `new` or a `create*` factory from application, adapters, or module infrastructure. Construct it in composition and inject it.
- `composition/hidden-wiring`: replace port setters, service locators, and registries with dependencies passed in by composition.

For legacy violations outside your change, propose a staged migration in the handoff rather than fixing them in passing. Keep everything you add compliant.
