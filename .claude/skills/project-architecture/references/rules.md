# Architecture rules

Modular monolith. Each module is split into three layers. Rules marked **[ID]** are enforced by
`npm run lint:arch` (dependency-cruiser, `.dependency-cruiser.cjs`); the rest are enforced in code review.

## Dependency direction

```
presentation  ──►  business  ◄──  infrastructure
   (in)             (core)            (out)
```

`business` depends on nothing outside itself. Presentation *calls* it; infrastructure *implements* its
interfaces. No arrow points out of `business`.

Other modules reach a module only through its `presentation/internal` API, and only via `index.ts`.
Nothing from `business/` is ever exported.

## Folder layout

```
src/
├── main.ts                         starts the transport (HTTP server, CLI runner, worker)
├── composition-root.ts             wires modules to each other
├── shared/
│   ├── errors.ts                   domain errors (NotFoundError, ValidationError)
│   ├── event-bus.ts                EventBus interface + DomainEvents contract
│   ├── in-memory-event-bus.ts      EventBus implementation
│   ├── http.ts                     HTTP types, Routes, error → status mapping
│   └── jobs.ts                     Job / Jobs types for cron and CLI entry points
└── modules/<module>/
    ├── index.ts
    ├── presentation/
    │   ├── api/                    HTTP controllers + <module>.routes.ts
    │   ├── internal/               API + facade offered to other modules
    │   ├── bus/                    event-bus subscribers
    │   ├── cli/                    CLI commands
    │   ├── cron/                   scheduled job entries
    │   ├── queue/<queue-name>/     consumers for an external queue
    │   └── dto/
    │       ├── api/                HTTP request / response DTOs (JSON-serializable)
    │       ├── internal/           DTOs of the internal API (inputs + outputs)
    │       └── mapper/             entity ↔ DTO mappers (the only place seeing both)
    ├── business/
    │   ├── domain/                 entities, value objects
    │   ├── service/                use cases (rules live here)
    │   ├── repository/             repository interfaces
    │   └── <capability>/           interfaces for other needs: mail/, payments/, customer/, …
    └── infrastructure/
        ├── repository/             repository implementations
        ├── <capability>/           implementations, mirroring business/<capability>
        └── internal/               adapters calling other modules
```

Create only the folders a module needs. Names that exist must mean exactly this.

## What goes where

| You are writing… | It goes in |
|---|---|
| HTTP controller | `presentation/api/` |
| The module's route table | `presentation/api/<module>.routes.ts` |
| Event-bus subscriber | `presentation/bus/` |
| CLI command | `presentation/cli/` |
| Cron job entry | `presentation/cron/` |
| Queue consumer | `presentation/queue/<queue-name>/` |
| Interface this module offers to other modules (`UsersApi`) | `presentation/internal/<module>.api.ts` |
| Implementation of that interface (`UsersFacade`) | `presentation/internal/<module>.facade.ts` |
| DTO: HTTP request / response | `presentation/dto/api/` |
| DTO: internal-API input or return type | `presentation/dto/internal/` |
| Entity ↔ DTO mapper | `presentation/dto/mapper/` |
| Entity, value object | `business/domain/` |
| Use case / service with rules | `business/service/` |
| Repository interface | `business/repository/` |
| Interface for anything else the module needs (mail, payments, another module's data) | `business/<capability>/` |
| Repository implementation | `infrastructure/repository/` |
| External API client, mailer, storage, … | `infrastructure/<capability>/` (same name as in business) |
| Adapter that calls another module | `infrastructure/internal/` |
| Wiring the module's own classes | `index.ts` |
| Wiring modules to each other | `composition-root.ts` |
| Starting the server | `main.ts` |
| Test | next to its subject, `*.test.ts` |

## When to create a module

A module is a **business capability that owns its own data and rules**. Its size and its current
number of consumers don't matter: apply the full structure even when the app is tiny.

Create a new module when **any** of these holds:
1. **Own data**: it has records that only it writes; others read them through its internal API
   (payments: charges, status, refunds).
2. **Own rules and vocabulary** that change for different reasons than its neighbours' (refund policy
   changes with the payment vendor or accounting; order rules change with the shop).
3. **More than one module needs it.** Then it must not live inside one of them.
4. **It could plausibly become a separate service or another team's responsibility.**

Keep it inside an existing module when:
- **it only exists as part of another entity's lifecycle** (order lines belong to `orders`);
- **it is a purely technical capability without business state** (sending mail, storing files,
  calling an SMS API): that is an adapter in `infrastructure/<capability>/` of the module that needs it;
- **the two parts would need constant synchronous calls in both directions**: the boundary is in the
  wrong place, and splitting would create a cycle.

**Test:** *"If this feature were deleted, which data and rules would disappear with it?"* If the answer
is a coherent set that belongs to nobody else, it is a module.

| Case | Decision | Why |
|---|---|---|
| Payments | own module | own records (charges, status), own rules (idempotency, retries), vendor will change |
| Welcome email | inside `notifications`; the mailer is an infrastructure adapter | notifications owns templates and preferences; sending is technical |
| Order lines | part of `orders` | no lifecycle of their own |
| Customer name on orders | stays in `users`; `orders` reads it via the internal API | users owns the data |
| Cleanup of inactive users | inside `users` | deletes users' data under users' rules |

## Rules

### Presentation

1. **Each presentation entry point owns its transport work.** A controller parses its request into a
   DTO, calls a service, maps the result with a mapper, and turns errors into status codes. Shared helpers
   for this live in `shared/http.ts`.
2. **Presentation checks shape, business checks rules.** "Is `qty` a number?" belongs in presentation;
   "is `qty` > 0?" belongs in a service.
3. **[L5] Entry points are independent.** `api/`, `internal/`, `bus/`, `cli/`, `cron/` and `queue/` may
   share `dto/` but never import each other.
4. **[L3] Presentation never imports infrastructure.**
5. **[L8] `shared/http.ts` is used only by `presentation/api/`.**
6. **[L6, L7] DTOs are data only.** DTO files import nothing but DTOs of their own family; only
   `dto/mapper/` knows entities.
7. **Entities never leave presentation.** Every response — HTTP or internal — is a DTO produced by a
   mapper.
8. **The facade goes through services, never repositories**, so other modules hit the same rules as
   HTTP callers.

### Internal API (`presentation/internal`)

9. **Inputs are DTOs too.** Every internal-API parameter is a `dto/internal/` type or a primitive —
   never an entity or other business type. Otherwise callers depend on your internals through the
   parameter.
10. **[L9, L10, L11] HTTP DTOs and internal DTOs are separate, even when identical.** HTTP DTOs follow
    the frontend and public API versioning; internal DTOs follow what other modules need. Sharing a type
    means a frontend change silently widens every module's contract. `api/` uses only `dto/api/`,
    `internal/` only `dto/internal/`; the two families never import each other.
11. **Internal DTOs are plain readonly data.** No classes, no methods, no entity references. Rich
    types like `Date` are allowed (nothing is serialized), but keep them serializable in principle so
    the module could become a remote service without changing the contract.
12. **Only `shared/errors.ts` errors leave the facade.** Expected absence is `null` (or a documented
    result type); anything else is mapped to a shared error. Module-specific exception types would
    otherwise become part of the public contract.
13. **Two mappings per call, deliberately.** The provider maps entity → internal DTO in its facade; the
    consumer maps internal DTO → its own concept in `infrastructure/internal/`. The second mapping is
    what keeps the provider's vocabulary out of the consumer's business layer.

### Business

14. **[L1] `business/` imports only its own `business/`, `shared/errors.ts`, `shared/event-bus.ts` and
   Node built-ins.** No HTTP, SQL, ORM, SDK or DTO imports.
15. **[L2] `business/domain/` imports only `business/domain/`.**
16. **Interfaces live where they are used.** Every interface business needs is declared in
    `business/repository/` or `business/<capability>/` and named in this module's vocabulary
    (`CustomerLookup`, not `UsersApi`).
17. **Services throw `shared/errors.ts` errors** and return entities; they never know about status codes or
    DTOs.
37. **Business exposes domain-level operations only.** Interfaces, services and internal APIs never
    leak SQL, HTTP, CLI flags, SDK message shapes, retries or mapping.
38. **A service owns a sequence.** When one logical action needs several calls in sequence, a service
    owns the sequence. An entry point never sequences services.

### Infrastructure

18. **[L4] Infrastructure implements business interfaces and never imports presentation.**
19. **`infrastructure/<capability>/` mirrors `business/<capability>/`.** `business/mail/mailer.ts` →
    `infrastructure/mail/smtp-mailer.ts`.
20. **Adapters to other modules live in `infrastructure/internal/`** and implement a business
    interface on top of the other module's internal API.
39. **Infrastructure throws domain errors.** It catches library and process errors and throws domain
    errors.

### Module boundaries

21. **[B1] Another module may be imported only through its `index.ts`.**
22. **[B2] Only `infrastructure/internal/` and `index.ts` may reference another module.**
23. **[B3] Nothing inside a module imports its own `index.ts`.**
24. **A module's `index.ts` exports only types from `presentation/internal/` and `presentation/dto/internal/`,
    plus its factory.** Nothing from `business/` or `infrastructure/`.
25. **Synchronous vs. event:** call another module's internal API when you need an answer to continue.
    Publish an event when announcing that something happened.
26. **Event payloads are public contracts.** They live in `shared/event-bus.ts` (`DomainEvents`).
36. **A module is named after its concern, never its provider.** Only infrastructure knows it is
    GitHub.

### Wiring

27. **Constructor injection only.** No service locators, no `new` of a dependency inside a class, no
    module-level singletons.
28. **`index.ts`** exports one `create<Module>Module(deps)` factory:
    - **in:** every external dependency, i.e. shared infrastructure (bus, DB pool, config) and other
      modules' internal APIs, plus optional overrides (`repo?`, `mailer?`) for tests;
    - **does:** creates the module's classes and wires them together;
    - **out:** `{ routes, jobs, internal }`. `routes` holds the HTTP handlers, `jobs` the cron/CLI
      entry points (keyed `<module>.<job-name>`), and `internal` the facades other modules may use. All
      are always present, even if empty. Event-bus handlers are registered inside the factory instead.
      A new transport (e.g. queue consumers) gets its own key, added to every module.
29. **`composition-root.ts`** creates shared infrastructure, calls each module's factory in dependency
    order, passes collected `internal` facades to the modules that need them, and merges `routes` and `jobs`.
    It contains no logic. **[W1]** It imports only modules' `index.ts` and `shared/`.
30. **[W2] Shared implementations (`in-memory-*`, real DB pools) are created only in the composition root.**
31. **[G1] The module dependency graph is acyclic.** If two modules need each other, one direction
    must become an event. The composition root couldn't wire a cycle anyway.

### Shared

32. **[S1] `shared/` never imports from `modules/`, `composition-root.ts` or `main.ts`.**
33. **`shared/` is a last resort**: only stable code with no business rules that several modules use.

### Tests

34. **Tests sit next to their subject.** Business tests use plain fakes for business interfaces; they do
    not need infrastructure (L1 exempts `*.test.ts` only for convenience, not by design).
35. **Module integration tests** live at the module root (`<module>/<module>.module.test.ts`), may
    import their own `index.ts` and shared in-memory implementations (exempt from B3 and W2), and
    still never import another module's internals.

## Adding a module — checklist

0. Check "When to create a module" — is this really a new module, or part of an existing one?
1. `business/domain/` entities → `business/service/` use cases → `business/repository/` and
   `business/<capability>/` interfaces.
2. `infrastructure/repository/` and `infrastructure/<capability>/` implementations.
3. `presentation/dto/api/` (+ `dto/internal/` if other modules need you) + `dto/mapper/`, then the entry points you need (`api/`, `bus/`, …).
4. If other modules need it: `presentation/internal/<module>.api.ts` + `.facade.ts` using only
   `dto/internal/` types; re-export the API and those DTOs from `index.ts`.
5. If it needs another module: an interface in `business/<capability>/`, an adapter in
   `infrastructure/internal/`, and the other module's API type as a factory dependency.
6. `index.ts` factory returning `{ routes, jobs, internal }`; call it from `composition-root.ts`.
7. `npm run check`.
