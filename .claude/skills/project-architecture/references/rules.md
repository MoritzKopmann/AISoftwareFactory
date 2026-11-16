# Architecture rules

## Scope

The complete rule set. Lint tags in brackets are checked by `npm run lint:arch`; the rest are checked in review.

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
    │   ├── errors/                 module errors, each a subclass of a shared/errors.ts kind
    │   ├── service/                use cases (rules live here)
    │   └── port/                   interfaces business needs, one folder per capability
    │       ├── repository/         repository interfaces
    │       ├── <capability>/       other needs: mail/, payments/, …
    │       └── <thing>/            one <Thing>Port per provider module: user/user.port.ts
    └── infrastructure/
        ├── repository/             repository implementations
        ├── <capability>/           implementations, mirroring business/port/<capability>
        └── internal/               one <Provider>Adapter per provider module: users.adapter.ts
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
| Module error (subclass of a `shared/errors.ts` kind; never exported from `index.ts`) | `business/errors/` |
| Use case / service with rules | `business/service/` |
| Repository interface | `business/port/repository/` |
| Interface for anything else the module needs (mail, payments) | `business/port/<capability>/` |
| Port to another module: one `<Thing>Port` per provider (`UserPort`) | `business/port/<thing>/` |
| Repository implementation | `infrastructure/repository/` |
| External API client, mailer, storage, … | `infrastructure/<capability>/` (same name as in business) |
| Adapter that calls another module: one `<Provider>Adapter` per provider (`UsersAdapter`) | `infrastructure/internal/<provider>-adapter.ts` |
| Wiring the module's own classes | `index.ts` |
| Wiring modules to each other | `composition-root.ts` |
| Starting the server | `main.ts` |
| Test | next to its subject, `*.test.ts` |


## When to create a module

A module is a **business capability that owns its own data and rules**. Its size and its current
number of consumers don't matter: apply the full structure even when the app is tiny.

Create a new module when **any** of these holds:

- **MC1 Must** **Own data**: it has records that only it writes; others read them through its internal API
  (payments: charges, status, refunds).
- **MC2 Must** **Own rules and vocabulary** that change for different reasons than its neighbours' (refund
  policy changes with the payment vendor or accounting; order rules change with the shop).
- **MC3 Must** **More than one module needs it.** Then it must not live inside one of them.
- **MC4 Must** **It could plausibly become a separate service or another team's responsibility.**

Keep it inside an existing module when:

- **MK1 Must** **it only exists as part of another entity's lifecycle** (order lines belong to `orders`);
- **MK2 Must** **it is a purely technical capability without business state** (sending mail, storing files,
  calling an SMS API): that is an adapter in `infrastructure/<capability>/` of the module that needs it;
- **MK3 Must** **the two parts would need constant synchronous calls in both directions**: the boundary is in
  the wrong place, and splitting would create a cycle.

**Test:** *"If this feature were deleted, which data and rules would disappear with it?"* If the answer
is a coherent set that belongs to nobody else, it is a module.

| Case | Decision | Why |
|---|---|---|
| Payments | own module | own records (charges, status), own rules (idempotency, retries), vendor will change |
| Welcome email | inside `notifications`; the mailer is an infrastructure adapter | notifications owns templates and preferences; sending is technical |
| Order lines | part of `orders` | no lifecycle of their own |
| Customer name on orders | stays in `users`; `orders` reads it via the internal API | users owns the data |
| Cleanup of inactive users | inside `users` | deletes users' data under users' rules |


## Presentation

- **PR1 Must** **Each presentation entry point owns its transport work.** A controller parses its request into a
  DTO, calls a service, maps the result with a mapper, and turns errors into status codes. Shared helpers
  for this live in `shared/http.ts`.
- **PR2 Must** **Presentation checks shape, business checks rules.** "Is `qty` a number?" belongs in presentation;
  "is `qty` > 0?" belongs in a service.
- **PR3 [L5] Must** **Entry points are independent.** `api/`, `internal/`, `bus/`, `cli/`, `cron/` and `queue/` may
  share `dto/` but never import each other.
- **PR4 [L3] Must** **Presentation never imports infrastructure.**
- **PR5 [L8] Must** **`shared/http.ts` is used only by `presentation/api/`.**
- **PR6 [L6, L7] Must** **DTOs are data only.** DTO files import nothing but DTOs of their own family; only
  `dto/mapper/` knows entities.
- **PR7 Must** **Entities never leave presentation.** Every response — HTTP or internal — is a DTO produced by a
  mapper.
- **PR8 Must** **The facade goes through services, never repositories**, so other modules hit the same rules as
  HTTP callers.

## Internal API (`presentation/internal`)

- **IA1 Must** **Inputs are DTOs too.** Every internal-API parameter is a `dto/internal/` type or a primitive —
  never an entity or other business type. Otherwise callers depend on your internals through the
  parameter.
- **IA2 [L9, L10, L11] Must** **HTTP DTOs and internal DTOs are separate, even when identical.** HTTP DTOs follow
  the frontend and public API versioning; internal DTOs follow what other modules need. Sharing a type
  means a frontend change silently widens every module's contract. `api/` uses only `dto/api/`,
  `internal/` only `dto/internal/`; the two families never import each other.
- **IA3 Must** **Internal DTOs are plain readonly data.** No classes, no methods, no entity references. Rich
  types like `Date` are allowed (nothing is serialized), but keep them serializable in principle so
  the module could become a remote service without changing the contract.
- **IA4 Must** **Only `shared/errors.ts` errors leave the facade.** Expected absence is `null` (or a documented
  result type); anything else is mapped to a shared error. Module-specific exception types would
  otherwise become part of the public contract.
- **IA5 Must** **Two mappings per call, deliberately.** The provider maps entity → internal DTO in its facade; the
  consumer maps internal DTO → its own concept in its one `<Provider>Adapter` in
  `infrastructure/internal/`. The second mapping is what keeps the provider's vocabulary out of the
  consumer's business layer.

## Business

- **BU1 [L1] Must** **`business/` imports only its own `business/`, `shared/errors.ts`, `shared/event-bus.ts` and
  Node built-ins.** No HTTP, SQL, ORM, SDK or DTO imports.
- **BU2 [L2] Must** **`business/domain/` imports only `business/domain/`.** `business/errors/` imports only
  `shared/errors.ts`.
- **BU3 Must** **Interfaces live where they are used.** Every interface business needs is declared in
  `business/port/<capability>/` (repositories in `business/port/repository/`) and named in this module's vocabulary.
  A port to another module is `<Thing>Port` (`<Thing>` = the provider module, singular), one per provider
  (`UserPort`, not `UsersApi`).
- **BU4 Must** **Services throw `shared/errors.ts` errors** and return entities; they never know about status codes or
  DTOs.
- **BU5 Must** **Business exposes domain-level operations only.** Interfaces, services and internal APIs never
  leak SQL, HTTP, CLI flags, SDK message shapes, retries or mapping.
- **BU6 Must** **A service owns a sequence.** When one logical action needs several calls in sequence, a service
  owns the sequence. An entry point never sequences services.
- **BU7 Must** **A class has one reason to change.** Test: describe it in one sentence without "and" or
  "or". `RunService` that starts runs **and** formats log lines is two classes.
- **BU8 Should** **Its methods use most of its fields.** A group of methods sharing only some of the
  fields is its own class.

## Infrastructure

- **IN1 [L4] Must** **Infrastructure implements business interfaces and never imports presentation.**
- **IN2 Must** **`infrastructure/<capability>/` mirrors `business/port/<capability>/`.** `business/port/mail/mailer.ts` →
  `infrastructure/mail/smtp-mailer.ts`.
- **IN3 Must** **One adapter per provider module, in `infrastructure/internal/<provider>-adapter.ts`.** `<Provider>Adapter`
  implements the one `<Thing>Port` for that provider on top of the provider's internal API. Its constructor
  takes `Pick<ProviderApi, …>` of the methods it calls. Never one adapter per capability.
- **IN4 Must** **Infrastructure throws domain errors.** It catches library and process errors and throws domain
  errors.

## Module boundaries

- **MB1 [B1] Must** **Another module may be imported only through its `index.ts`.**
- **MB2 [B2] Must** **Only `infrastructure/internal/` and `index.ts` may reference another module.**
- **MB3 [B3] Must** **Nothing inside a module imports its own `index.ts`.**
- **MB4 Must** **A module's `index.ts` exports only types from `presentation/internal/` and `presentation/dto/internal/`,
  plus its factory.** Nothing from `business/` or `infrastructure/`.
- **MB5 Must** **Synchronous vs. event:** call another module's internal API when you need an answer to continue.
  Publish an event when announcing that something happened.
- **MB6 Must** **Event payloads are public contracts.** They live in `shared/event-bus.ts` (`DomainEvents`).
- **MB7 Must** **A module is named after its concern, never its provider.** Only infrastructure knows it is
  GitHub.

## Wiring

- **WI1 Must** **Constructor injection only.** No service locators, no `new` of a dependency inside a class, no
  module-level singletons.
- **WI2 Must** **`index.ts`** exports one `create<Module>Module(deps)` factory:
  - **in:** every external dependency, i.e. shared infrastructure (bus, DB pool, config) and other
    modules' internal APIs, plus optional overrides (`repo?`, `mailer?`) for tests;
  - **does:** creates the module's classes and wires them together;
  - **out:** `{ routes, jobs, internal }`. `routes` holds the HTTP handlers, `jobs` the cron/CLI
    entry points (keyed `<module>.<job-name>`), and `internal` the facades other modules may use. All
    are always present, even if empty. Event-bus handlers are registered inside the factory instead.
    A new transport (e.g. queue consumers) gets its own key, added to every module.
- **WI3 [W1] Must** **`composition-root.ts`** creates shared infrastructure, calls each module's factory in dependency
  order, passes collected `internal` facades to the modules that need them, and merges `routes` and `jobs`.
  It contains no logic. It imports only modules' `index.ts` and `shared/`.
- **WI4 [W2] Must** **Shared implementations (`in-memory-*`, real DB pools) are created only in the composition root.**
- **WI5 [G1] Must** **The module dependency graph is acyclic.** If two modules need each other, one direction
  must become an event. The composition root couldn't wire a cycle anyway.
- **WI6 Must** **No DI container, decorators, `reflect-metadata`, service locators or module-level singletons** —
  the compiler checks plain wiring for free, and tests just pass fakes.

## Shared

- **SH1 [S1] Must** **`shared/` never imports from `modules/`, `composition-root.ts` or `main.ts`.**
- **SH2 Should** **`shared/` is a last resort**: only stable code with no business rules that several modules use.

## Tests

- **TE1 Must** **Tests sit next to their subject.** Business tests use plain fakes for business interfaces; they do
  not need infrastructure (L1 exempts `*.test.ts` only for convenience, not by design).
- **TE2 Must** **Module integration tests** live at the module root (`<module>/<module>.module.test.ts`), may
  import their own `index.ts` and shared in-memory implementations (exempt from B3 and W2), and
  still never import another module's internals.

## Steps

### Adding a module

1. **Goal:** decide this is a new module.
   - **Actions:** apply "When to create a module" (MC1–MC4, MK1–MK3 and the Test).
   - **Done:** a criterion MC1–MC4 holds and no MK rule applies.
   - **Exits:** MK rule applies → stop, put it in the existing module.
2. **Goal:** the business layer.
   - **Actions:** `business/domain/` entities → `business/service/` use cases → `business/port/` interfaces (`repository/` and `<capability>/`).
   - **Done:** the three folders hold what the module needs.
3. **Goal:** the infrastructure layer.
   - **Actions:** `infrastructure/repository/` and `infrastructure/<capability>/` implementations.
   - **Done:** every port has an implementation.
4. **Goal:** the presentation layer.
   - **Actions:** `presentation/dto/api/` (+ `dto/internal/` if other modules need you) + `dto/mapper/`, then the entry points you need (`api/`, `bus/`, …).
   - **Done:** every entry point has its DTOs and mapper.
5. **Goal:** offer the module to others, if they need it.
   - **Actions:** `presentation/internal/<module>.api.ts` + `.facade.ts` using only `dto/internal/` types; re-export the API and those DTOs from `index.ts`.
   - **Done:** `index.ts` exports only what MB4 allows.
6. **Goal:** consume another module, if this one needs it.
   - **Actions:** one `<Thing>Port` in `business/port/<thing>/` per provider, one `<Provider>Adapter` in `infrastructure/internal/<provider>-adapter.ts`, and the other module's API type as a factory dependency.
   - **Done:** IN3 and BU3 hold.
7. **Goal:** wire the module.
   - **Actions:** `index.ts` factory returning `{ routes, jobs, internal }`; call it from `composition-root.ts`.
   - **Done:** WI2 and WI3 hold.
8. **Goal:** check.
   - **Actions:** `npm run check`.
   - **Done:** the check passes.
