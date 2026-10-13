---
name: project-architecture
user-invocable: false
description: Rules and a working reference implementation for a TypeScript modular monolith built from modules that each have three layers (presentation / business / infrastructure), with constructor-based dependency injection, internal facades and event-bus communication between modules, and dependency-cruiser enforcement. Use this skill whenever writing, moving, reviewing or planning backend TypeScript code in a project that follows this structure, and whenever the user asks where a file belongs, how to add a module/use case/endpoint/repository/event handler/cron job/queue consumer, how modules should talk to each other, how to wire dependencies, how to structure DTOs or mappers, or wants a new TypeScript backend set up with a clean layered or hexagonal architecture — even if they don't say "architecture".
---

# Layered modular architecture (TypeScript)

The application is a modular monolith. Each feature module (`users`, `orders`, …) is split into three
layers, and modules talk to each other only through narrow, explicit contracts. The goal is that any
module can be understood, tested and replaced on its own, and that a module could later become a
separate service without its business code changing.

The **complete rule set** is in `references/rules.md`. Read it before making non-trivial changes: it
holds the full placement table, all 39 rules, and the checklist for new modules. This file gives you the
mental model, the workflows, and a map of the example app.

A **working example app** that follows every rule is in `assets/example-app/`. When you are unsure how
something should look, open the matching file there and copy its shape. The map below tells you which
file shows what.

## The model in one picture

```
presentation  ──►  business  ◄──  infrastructure
   (in)             (core)            (out)
```

- **business** is the core: entities, use cases, and the *interfaces* for everything it needs
  (repositories, mailers, other modules). It imports nothing outside itself except `shared/errors.ts`
  and `shared/event-bus.ts`. No HTTP, SQL, ORM, SDK or DTOs.
- **presentation** holds every way *into* the module: HTTP controllers, event-bus subscribers,
  CLI/cron/queue entry points, and the internal API other modules call. It parses input, calls
  services, maps entities to DTOs and translates errors.
- **infrastructure** holds every way *out*: repository implementations, external clients, and adapters
  that call other modules. It implements business interfaces.

The arrows matter more than the folders. Interfaces live where they are *used* (business), so
infrastructure depends on business, never the other way round. If you find yourself importing
something "upward", stop: the interface is in the wrong place.

## Module layout

```
src/
├── main.ts                     starts the transport
├── composition-root.ts         wires modules to each other (only imports module index.ts files)
├── shared/                     errors.ts, event-bus.ts (+ impl), http.ts, jobs.ts — last resort, no business rules
└── modules/<module>/
    ├── index.ts                create<Module>Module(deps) → { routes, jobs, internal }
    ├── presentation/
    │   ├── api/                HTTP controllers + <module>.routes.ts
    │   ├── internal/           <module>.api.ts (interface) + <module>.facade.ts — for other modules
    │   ├── bus/  cli/  cron/  queue/<queue-name>/
    │   └── dto/
    │       ├── api/            HTTP DTOs (JSON-serializable)
    │       ├── internal/       internal-API DTOs (plain readonly data)
    │       └── mapper/         entity ↔ DTO — the only place that sees both
    ├── business/
    │   ├── domain/             entities, value objects (pure)
    │   ├── service/            use cases — all rules live here
    │   ├── repository/         repository interfaces
    │   └── <capability>/       other needs: mail/, payments/, customer/ …
    └── infrastructure/
        ├── repository/         repository implementations
        ├── <capability>/       mirrors business/<capability>/
        └── internal/           adapters calling other modules
```

Only create the folders a module needs.

## Example app map

All paths are relative to `assets/example-app/`. Run `npm install && npm run check` there to typecheck,
run the architecture linter and the tests. `npm run demo` exercises the whole flow.

| To see how to… | Open |
|---|---|
| Structure a module's entry point (deps in, `{ routes, jobs, internal }` out) | `src/modules/users/index.ts` |
| Wire modules together | `src/composition-root.ts` |
| Write a use case with injected interfaces | `src/modules/orders/business/service/order.service.ts` |
| Test a use case with plain fakes | `src/modules/orders/business/service/order.service.test.ts` |
| Declare a repository interface / implement it | `users/business/repository/user.repository.ts` → `users/infrastructure/repository/in-memory-user.repository.ts` |
| Declare a capability interface / implement it | `notifications/business/mail/mailer.ts` → `notifications/infrastructure/mail/console-mailer.ts` |
| Write an HTTP controller + route table | `users/presentation/api/user.controller.ts`, `user.routes.ts` |
| Separate HTTP DTOs from internal DTOs | `users/presentation/dto/api/user.dto.ts` vs `users/presentation/dto/internal/user-summary.dto.ts` |
| Map entities to DTOs | `users/presentation/dto/mapper/user.mapper.ts` |
| Offer an internal API to other modules | `users/presentation/internal/users.api.ts` + `users.facade.ts` |
| Consume another module's API (anti-corruption adapter) | `orders/business/customer/customer-lookup.ts` → `orders/infrastructure/internal/users-customer-lookup.ts` |
| React to events from other modules | `notifications/presentation/bus/event-handlers.ts` |
| Publish an event | `orders/business/service/order.service.ts` (`bus.publish`) + `src/shared/event-bus.ts` (`DomainEvents`) |
| Enforce the rules automatically | `.dependency-cruiser.cjs` (rule IDs match `[L1]`, `[B2]` … in rules.md) |

(`users/…`, `orders/…`, `notifications/…` are under `src/modules/`.)

## Workflows

### Placing a single file
Find it in the "What goes where" table in `references/rules.md`. If nothing fits, ask which layer it
belongs to by direction: is it a way *in* (presentation), a rule (business), or a way *out*
(infrastructure)? Interfaces go to the layer that *uses* them.

### Adding a use case or endpoint to an existing module
1. Entity changes → `business/domain/`. Rules → a method on a service in `business/service/`.
2. New persistence needs → extend the interface in `business/repository/`, then the implementation(s)
   in `infrastructure/repository/`.
3. HTTP: request/response DTOs in `dto/api/`, mapper in `dto/mapper/`, controller method in
   `presentation/api/`, route in `<module>.routes.ts`.
4. Keep checks split: shape checks (is it a number?) in the controller, business rules (is it > 0?)
   in the service.

### Deciding whether something is a new module
Do this before writing code for any new feature, and especially when building from an empty project —
that is where it is most tempting to fold everything into one or two modules "because nothing else
needs it yet". A module is a **business capability that owns its own data and rules**; size and
current number of consumers don't matter.

Create a module when **any** of these holds:
1. **Own data** — it has records only it writes (payments: charges, status, refunds).
2. **Own rules and vocabulary** that change for different reasons than its neighbours'.
3. **Several modules need it.**
4. **It could plausibly become a separate service or another team's responsibility.**

Keep it inside an existing module when:
- it only exists as part of another entity's lifecycle (order lines → `orders`);
- it is a purely technical capability without business state (sending mail, storing files, SMS) — an
  adapter in `infrastructure/<capability>/` of the module that uses it;
- the two parts would need constant synchronous calls in both directions (the boundary is wrong).

Test: *"If this feature were deleted, which data and rules would disappear with it?"* A coherent set
that belongs to nobody else is a module. Example: storing "paid" status on the order inside `orders`
is wrong — payment records belong to a `payments` module, and `orders` asks it for status through its
internal API. The "When to create a module" section in `references/rules.md` has the full version with more examples.

### Adding a module
Follow the checklist at the end of `references/rules.md`. Every module's `index.ts` exports exactly one
`create<Module>Module(deps)` factory returning `{ routes, jobs, internal }` (all always present, possibly
empty; cron/CLI entry points go into `jobs`, keyed `<module>.<job-name>`), plus type-only re-exports of its `presentation/internal` API and `dto/internal` types — nothing
from `business/` or `infrastructure/`.

### Module A needs something from module B
Decide first: **does A need an answer to continue?**
- **Yes → synchronous call through B's internal API.**
  1. In B: add the method to `presentation/internal/<b>.api.ts`; inputs and outputs are `dto/internal/`
     types or primitives. Implement it in the facade by calling B's *services* (never repositories),
     mapping with B's mapper. Only `shared/errors.ts` errors (or `null` for expected absence) may escape.
  2. In A: declare what A needs as an interface in `business/<capability>/`, named in A's vocabulary
     (orders has `CustomerLookup.exists()`, not `UsersApi`).
  3. In A: implement it in `infrastructure/internal/<b>-<capability>.ts`, importing only B's `index.ts`.
  4. Add B's API type to A's factory deps; pass `b.internal.x` in `composition-root.ts`.
- **No, A is announcing that something happened → event.** Add the payload to `DomainEvents` in
  `shared/event-bus.ts` (it's a public contract), publish from A's service, subscribe in B's
  `presentation/bus/`.

The module graph must stay acyclic: the composition root calls factories in dependency order, so if
A and B need each other, turn one direction into an event.

### Dependency injection
Constructor injection only, wired by hand: each module wires its own classes in `index.ts`; the
composition root only creates shared infrastructure (bus, DB pool, config), calls module factories and
passes facades between them. No DI container, decorators, `reflect-metadata`, service locators or
module-level singletons — the compiler checks plain wiring for free, and tests just pass fakes.
Factories accept optional overrides (`repo?`, `mailer?`) for tests and other environments.

### Reviewing code
Check imports against the dependency direction first; that catches most violations. Then the rules the
linter cannot see: entities leaking through DTOs, business rules in controllers, facades going to
repositories, module-specific errors escaping a facade, `index.ts` re-exporting business types. Cite
the rule number from `references/rules.md` so the author can look it up.

## Enforcement

`assets/example-app/.dependency-cruiser.cjs` enforces the import rules (dependency-cruiser 16).
For a new project, copy it to the repo root, `npm i -D dependency-cruiser@16`, and add
`"lint:arch": "depcruise src --config .dependency-cruiser.cjs"`. If the project already uses these
folder names, it works unchanged. Always run it (and `tsc`) after structural changes — it is much
faster than reasoning about imports by hand, and every rule ID in its output maps to `references/rules.md`.

When the user's project deviates from these rules on purpose (different folder names, an existing DI
container, a framework like NestJS with its own module system), follow the project and say which rule
you are adapting and why. The rules exist to keep dependencies pointing one way and contracts narrow;
honour that intent rather than the literal folder names.
