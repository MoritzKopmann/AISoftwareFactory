---
name: project-architecture
description: >
  AISoftwareFactory architecture reference: stack, module and folder layout, class types,
  naming, placement rules and hard bans for the aisf app. Use when placing files, naming
  things, choosing a module or layer, wiring modules together, or making any structural decision.
user-invocable: false
---

## Stack

- **TypeScript**, strict (`tsconfig.base.json`: `NodeNext`, ESM only, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`).
- **Node ≥22**, one process. `node:sqlite` for persistence (no native deps).
- **npm workspaces** monorepo, published as the npm CLI **`aisf`**.
- **Server:** Hono on `@hono/node-server`, SSE, Zod schemas shared between API and UI.
- **Sessions:** the Claude Agent SDK. Each Claude session is its own `claude` subprocess spawned by the SDK. GitHub is reached through `gh` and its GraphQL/REST APIs.
- **UI:** a React SPA built with Vite. Bridge pages are plain HTML using the `<aisf-*>` elements from the app-served `/aisf/kit.js` and the `kit.css` tokens.
- **Tooling:** vitest, ESLint (`typescript-eslint` strict), Prettier, dependency-cruiser.

## Module layout

```
packages/
├── app/                              ← the server and CLI (@aisf/app)
│   ├── src/
│   │   ├── main.ts                   ← composition root
│   │   ├── shared/                   ← typed event bus, db (connection + migrations), config, logger, process
│   │   └── modules/
│   │       └── <name>/               ← module root
│   │           ├── index.ts          ← the module's only public surface
│   │           ├── api/              ← inbound adapters
│   │           │   ├── routes/       ← Hono routes, one file per resource
│   │           │   ├── subscriptions/← bus subscriptions, one per event handled
│   │           │   └── tools/        ← MCP tool handlers, one per tool
│   │           ├── logic/            ← pure TS, no I/O
│   │           │   ├── domain/       ← immutable domain types and pure domain functions
│   │           │   ├── use-cases/    ← one use case per file
│   │           │   ├── ports/        ← interfaces logic needs: repositories, integrations, clock
│   │           │   └── errors/       ← domain errors, one per file
│   │           └── infra/            ← outbound adapters, implementing logic's ports
│   │               ├── repositories/ ← SQLite implementations of repository ports
│   │               └── integrations/ ← gh, Agent SDK, file system and process implementations
│   └── test/                         ← mirrors src/
├── ui/                               ← the React SPA (@aisf/ui)
└── plugin/                           ← the aisf Claude Code plugin: skills and agents (@aisf/plugin)
```

**Rule:** every file lives in the folder its class type names (see `## Class types`).

- **Must:** only create folders that contain files.
- **Must:** a module root holds `index.ts` and the three layer folders, nothing else.
- **Should:** files stay under 500 lines. Over that, split.

**Module-root pattern:** `packages/app/src/modules/<name>/`. The seven modules are:

| Module | Owns |
|---|---|
| `projects` | Registers a checkout as exactly one GitHub repo, with the repo slug `owner/name` as its id. |
| `watcher` | Polls GitHub (ETag feeds + GraphQL snapshot) and emits snapshot diffs per repo. Read-only. |
| `scheduler` | The only module that decides to start work: turns diffs into stage runs, runs pre-flight, enforces concurrency (serial per project). Makes the app's only two GitHub writes. |
| `runner` | The only module that touches the Agent SDK: `query()` per run, the prompt iterable, `canUseTool`/HITL routing, transcripts, exit status. Also owns worktrees (`~/.aisf/worktrees/<project>/<ticket>`). |
| `bridge` | Serves `<worktree>/.aisf/artifacts`, `bridge.js`, `kit.js`/`kit.css` and SSE, and provides the `aisf_show_artifact` tool. |
| `skills` | The `aisf` plugin mirror in `~/.aisf/plugins`, per-project install/sync, and the pre-flight checks the Scheduler calls. |
| `ui` | The Hono JSON API + SSE for the browser views, and serving the static SPA. |

Commit scopes: a module's name for changes under its root. Outside module roots: `shared` (`packages/app/src/shared/`), `app` (`main.ts` and other `packages/app` files), `ui` (`packages/ui/`), `plugin` (`packages/plugin/`).

## Class types

**Rule:** every file has one type, one form, one location.

| Type | Form | Location | Example |
|---|---|---|---|
| Domain type | `type` with `readonly` fields | `logic/domain/` | `Run`, `TicketSnapshot` |
| Domain function | pure function over domain types | `logic/domain/` | `diffSnapshots` |
| Use case | class, constructed with its ports, one public method `execute` | `logic/use-cases/` | `StartRunUseCase` |
| Repository port | `interface` | `logic/ports/` | `RunRepository` |
| Integration port | `interface` | `logic/ports/` | `GitHubIntegration`, `Clock` |
| Domain error | class `extends Error` | `logic/errors/` | `WorktreeMissingError` |
| API schema | zod schema and its inferred type, one file per resource | `modules/ui/api/schemas/` | `projects-schemas.ts` |
| Route | function returning a Hono app | `api/routes/` | `createRunRoutes` |
| Subscription | function registering one bus handler | `api/subscriptions/` | `subscribeToSnapshotChanged` |
| MCP tool handler | function returning the tool definition | `api/tools/` | `createShowArtifactTool` |
| Repository impl | class `implements` a repository port | `infra/repositories/` | `SqliteRunRepository` |
| Integration impl | class `implements` an integration port | `infra/integrations/` | `GhCliGitHubIntegration`, `SystemClock` |
| Module factory | function taking the module's adapters, returning its public interface | `index.ts` | `createRunnerModule` |

### Where does X go?

| I need to… | Build |
|---|---|
| Model a thing the module reasons about | Domain type in `logic/domain/` |
| Compute something from domain data, no I/O | Domain function in `logic/domain/` |
| Add an operation the outside world triggers | Use case in `logic/use-cases/`, called from an `api/` adapter |
| Persist data | Repository port in `logic/ports/`, impl in `infra/repositories/`, plus a migration |
| Call GitHub, the SDK, the file system or a process | Integration port in `logic/ports/`, impl in `infra/integrations/` |
| Expose an HTTP endpoint or SSE stream | Route in `api/routes/` |
| React to another module's announcement | Subscription in `api/subscriptions/` |
| Give sessions a new tool | MCP tool handler in `api/tools/` |
| Let another module ask this one something | A method on the public interface in `index.ts`, backed by a use case |
| Announce something | A bus event, typed in `shared/`'s event map, emitted from a use case through a bus port |
| Signal a failure the caller must handle | Domain error in `logic/errors/` |

## Naming conventions

**Rule:** names state what a thing is or holds. Full English words only.

### Files and types

- **Must:** file names are kebab-case and named after the one thing they export: `StartRunUseCase` lives in `start-run-use-case.ts`.
- **Must:** a class name ends in its type where the table above gives one (`…UseCase`, `…Repository`, `…Integration`, `…Error`). An implementation is prefixed with what it's built on: `SqliteRunRepository`, `GhCliGitHubIntegration`.
- **Must:** a port is named after its role, never `I…` or `…Interface`.

### Variables

- **Must:** no abbreviations, no single letters, no truncation. The name states what the value holds.
- **Exception:** a classic numeric `for` loop counter may be `index`. Prefer `for … of` with a real name.
- **Applies to:** locals, fields, parameters, constants, callback and lambda parameters, destructured names, generic type parameters beyond a single obvious `T`.

```ts
// Bad
const d = Date.now() - start;
const n = runs.length;
const cfg = loadConfig();
const res = await gh.graphql(q);
issues.map((i) => i.number);

// Good
const elapsedMilliseconds = Date.now() - startedAt;
const runCount = runs.length;
const config = loadConfig();
const snapshotResponse = await gitHub.graphql(snapshotQuery);
issues.map((issue) => issue.number);
```

## Placement rules

### Dependency direction

**Rule:** dependencies point inward: `api → logic ← infra`.

- **Must:** `logic/` imports only `logic/` and `shared/`'s types. Never `api/`, `infra/`, Node I/O, `node:sqlite`, Hono, the Agent SDK or `gh`.
- **Must:** inside `logic/`, `domain/` imports nothing but `domain/`. `use-cases/` import `domain/`, `ports/` and `errors/`.
- **Must:** `api/` calls use cases only. It never imports `infra/` or a port implementation.
- **Must:** `infra/` imports only `ports/`, `domain/` and `errors/` from `logic/`.

### Between modules

**Rule:** another module is reached only through its `index.ts`.

- **Must:** `index.ts` exports the module factory, its public interface and the types that interface uses. Nothing else.
- **Must:** use a synchronous call through the public interface when the caller needs an answer (Scheduler → `runner.start`). Use a typed bus event for announcements nobody has to answer (`snapshot.changed`, `run.finished`).
- **Must:** each module owns its tables. It persists through a repository in its own `infra/`, on top of `shared/db`. Another module never reads those tables. It asks the owning module through its public interface.
- **Must:** `logic/` reaches another module only through its own ports, filled in by `main.ts`. It never imports another module directly, not even through that module's `index.ts`.
- **Must:** a use case announces something by depending on `EventPublisher` (`shared/bus/event-publisher.ts`), never a concrete bus.

### Composition

**Rule:** `main.ts` is the only place that builds concrete classes.

- **Must:** `main.ts` constructs every module's infra adapters and passes them to that module's factory. It is the only file outside a module that may import that module's `infra/`.
- **Must:** each module's wiring is a `build<Name>Module(...)` function local to `main.ts` — it constructs that module's infra adapters and calls its `create<Name>Module` factory, returning the module's public interface. `main.ts`'s top level is then a flat list of `const <name> = build<Name>Module(...)` calls, in start-up order. This keeps every module's construction still in `main.ts` (the rule above still holds) while keeping the top level readable as the module count grows.
- **Must:** everything under `~/.aisf` is reached through `shared/config`, whose home is overridable, so tests use a temp dir.
- **Must:** `shared/` holds only cross-cutting infrastructure (bus, db, config, logger, process). Domain logic never goes there.

### Deep modules

**Rule:** ports, use cases and public interfaces expose domain-level operations only.

- **Must:** never leak SQL, HTTP, `gh` flags, SDK message shapes, retries or mapping to callers.
- **Must:** if one logical action needs two or more calls in sequence, a use case owns that sequence. An api adapter never sequences use cases.
- **Must:** infra catches library and process errors and throws domain errors, e.g. `GitHubRateLimitedError`. Callers catch the named domain error, never a bare `catch` or `Error`. The only exception is a documented "never crash" boundary, like the server's top-level error handler.

```ts
// Shallow: leaks storage
interface RunRepository {
  query(sql: string, parameters: unknown[]): Promise<unknown[]>;
}

// Deep: domain-level
interface RunRepository {
  findActive(projectId: ProjectId): Promise<Run | undefined>;
  save(run: Run): Promise<void>;
}
```

### Adapters hold no logic

**Rule:** an `api/` adapter parses input, calls one use case and maps the result. Nothing else.

- **Must:** no business decisions in routes, subscriptions or tool handlers. Move them into a use case.
- **Must:** input from HTTP or MCP is validated with a Zod schema at the adapter, before it reaches logic.

### Domain types are immutable

**Rule:** a domain value never changes. A change produces a new value.

- **Must:** `readonly` fields and `ReadonlyArray`/`ReadonlyMap` collections.
- **Must:** no classes with mutable state in `domain/`. Use plain types and pure functions.

### Truth and persistence

- **Must:** ticket status, hierarchy, blocking and PRs are read from GitHub, never mirrored into SQLite. The Watcher snapshot and ETags are in memory and rebuilt on boot.
- **Must:** app facts live in `~/.aisf/aisf.db`. Session transcripts stay in Claude Code's own JSONL, read by sessionId. Artifacts stay in `<worktree>/.aisf/`.
- **Must:** SQL is one template string per statement, one clause or column per line, with parameters bound, never interpolated.

```ts
database.prepare(`
  SELECT id, ticket, stage, state
  FROM runs
  WHERE project_id = ?
`);
```

Dependency direction and the module boundaries are enforced by dependency-cruiser in `analyze`.

## Comments

**Rule:** code is simple and explains itself. Comments are rare and describe the current code only.

**Must not:**
- **Document history or decisions.** No "changed from X", "previously", "we chose", ticket or PR refs. How we got here lives in git and the tickets.
- **Restate the code.** `// increment counter` above `counter++` is noise.
- **Comment out code.** Delete it. Git has it.
- **Add banners.** No `// ---- Helpers ----`. Split the file instead.
- **Leave a TODO without a ticket.** Use `// TODO(#123): …`, or open an issue.
- **Add a JSDoc block that repeats the name and signature.** Types already document parameters and return values.

**Must:**
- **Rename before commenting.** If a name needs a comment, fix the name first.
- **Comment only when the code can't explain itself:** how a function works when its name and body don't show it, why unusual code is the way it is, or a constraint from outside the code (an API quirk, a protocol rule).
- **Keep comments true.** Change the code, update or delete its comment in the same change.
- **Follow the same rules in tests.** A short comment on a non-obvious arrange step is fine.

```ts
// Bad: history and restating
// Switched to a Set in #123 (was an array)
const seenIssueNumbers = new Set<number>(); // set of seen numbers

// Good: explains an outside constraint
// GitHub returns 304 without a body for an unchanged ETag, so keep the previous page.
if (response.status === 304) return previousPage;
```

## Hard bans

- **No central Store module.** No module owns another module's data.
- **No import that reaches past another module's `index.ts`** (`modules/x/logic/…` from `modules/y`).
- **No `new` of a concrete adapter outside `main.ts`.** No service locator, no global singletons.
- **Only `scheduler` writes to GitHub,** and only its two transitions: closing a finished `planned` parent, and `→ stuck`.
- **Only `runner` imports the Agent SDK.**
- **No second process:** no daemon plus separate UI process, and no process per project.
- **No persistence besides `aisf.db`:** no JSON state files, no native SQLite binding.
- **Rejected stacks stay rejected:** htmx, Fastify, Svelte, Docker, a single binary.
- **No global 3-layer split** (a top-level `api/`, `logic/`, `infra/` across modules). Layers live inside each module.
- **No fresh worktree per stage.** One worktree per ticket, reused across its stages.
- **No parallel sibling runs by default.** Concurrency is serial per project.

## Plan vocabulary

A plan names its changes by the types in `## Class types` (domain type, use case, port, route, …), plus the module each belongs to, the bus events it adds and the tables it migrates.

Confirm-page lanes, left to right: **UI** · **api** · **logic** · **infra** · **GitHub / Claude**.

## UI

**Yes.** Plans that touch these surfaces cover their empty, loading, error and too-much-data states:

- **The browser app** (`packages/ui`, a React SPA): project board, ticket pages, "Needs you", run transcripts, Known bugs, settings.
- **Bridge pages**: the interview and confirm pages sessions show under `.aisf/artifacts`, built from the `<aisf-*>` kit elements.

## Easy-to-miss wiring

- **A new module** needs its `index.ts` factory, a `build<Name>Module` function in `main.ts`, and a matching dependency-cruiser rule.
- **A new table** needs a migration in `shared/db`. Never edit an applied migration.
- **A new bus event** needs its type added to the bus's event map in `shared/`, or subscribers don't type-check.
- **A new API route** needs its Zod schema shared with `packages/ui`, so the SPA and server agree.
- **A new app MCP tool** (`aisf_*`) needs registering in the in-process MCP server that `runner` hands to each `query()`, and allowing in the session's tool permissions.
- **A new config key** goes through `shared/config`, so tests can override `~/.aisf`.
- **Changes under `packages/plugin`** reach sessions only after the `skills` module mirrors the plugin into `~/.aisf/plugins/aisf/` (on app start). Hand-run sessions use the marketplace path.
- **A new external CLI dependency** (beyond `gh` and `claude`) needs adding to the `aisf` CLI's start-up pre-flight.
- **`.aisf/` is gitignored** in every worktree. Artifacts are never committed.

## Load also

None yet.
