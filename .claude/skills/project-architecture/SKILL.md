---
name: project-architecture
description: >
  AISoftwareFactory architecture reference: stack, module layout, placement rules and hard bans
  for the aisf app. Use when placing files, choosing a module or layer, wiring modules together,
  or making any structural decision.
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
├── app/                     ← the server and CLI (@aisf/app)
│   ├── src/
│   │   ├── main.ts          ← composition root
│   │   ├── shared/          ← typed event bus, db (connection + migrations), config, logger
│   │   └── modules/
│   │       └── <name>/      ← module root
│   │           ├── index.ts ← the module's only public surface
│   │           ├── api/     ← inbound adapters: Hono routes, bus subscriptions, MCP tool handlers
│   │           ├── logic/   ← pure TS: use cases, domain types, the ports it needs
│   │           └── infra/   ← outbound adapters: implements logic's ports (SQLite repos, SDK, gh, fs)
│   └── test/                ← mirrors src/
├── ui/                      ← the React SPA (@aisf/ui)
└── plugin/                  ← the aisf Claude Code plugin: skills and agents (@aisf/plugin)
```

**Module-root pattern:** `packages/app/src/modules/<name>/`. The six modules are:

| Module | Owns |
|---|---|
| `watcher` | Polls GitHub (ETag feeds + GraphQL snapshot) and emits snapshot diffs per repo. Read-only. |
| `scheduler` | The only module that decides to start work: turns diffs into stage runs, runs pre-flight, enforces concurrency (serial per project). Makes the app's only two GitHub writes. |
| `runner` | The only module that touches the Agent SDK: `query()` per run, the prompt iterable, `canUseTool`/HITL routing, transcripts, exit status. Also owns worktrees (`~/.aisf/worktrees/<project>/<ticket>`). |
| `bridge` | Serves `<worktree>/.aisf/artifacts`, `bridge.js`, `kit.js`/`kit.css` and SSE, and provides the `aisf_show_artifact` tool. |
| `skills` | The `aisf` plugin mirror in `~/.aisf/plugins`, per-project install/sync, and the pre-flight checks the Scheduler calls. |
| `ui` | The Hono JSON API + SSE for the browser views, and serving the static SPA. |

Commit scopes: a module's name for changes under its root. Outside module roots: `shared` (`packages/app/src/shared/`), `app` (`main.ts` and other `packages/app` files), `ui` (`packages/ui/`), `plugin` (`packages/plugin/`).

## Placement rules

- **Inside a module the direction is `api → logic ← infra`.** `logic/` is pure TS and declares the interfaces (ports) it needs. `infra/` implements them (dependency inversion). `api/` holds the inbound adapters and calls into `logic/`.
- **Between modules, imports go only through the other module's `index.ts`.** `index.ts` exports the module's public interface, its event types and its factory. Nothing else.
- **Sync call or bus event:** use a synchronous call through `index.ts` when the caller needs an answer (Scheduler → `runner.start`). Use a typed bus event for announcements nobody has to answer (`snapshot.changed`, `run.finished`).
- **`main.ts` is the only place that builds concrete classes.** It constructs every module's infra adapters and hands them in. It is the only file outside a module that may import that module's `infra/`.
- **Each module owns its tables.** A module persists through a repository in its own `infra/`, on top of `shared/db`. No other module reads those tables. It asks the owning module through `index.ts`.
- **Ticket truth lives on GitHub, app facts in `~/.aisf/aisf.db`.** Status, hierarchy, blocking and PRs are read from GitHub, never mirrored into SQLite. The Watcher snapshot and ETags are in memory and rebuilt on boot. Session transcripts stay in Claude Code's own JSONL, read by sessionId. Artifacts stay in `<worktree>/.aisf/`.
- **`shared/` holds only cross-cutting infrastructure** (bus, db, config, logger). Domain logic never goes there.
- Everything under `~/.aisf` is reached through `shared/config`, whose home is overridable, so tests use a temp dir.

These rules are enforced by dependency-cruiser in `analyze`.

## Hard bans

- **No central Store module.** No module owns another module's data.
- **No import that reaches past another module's `index.ts`** (`modules/x/logic/…` from `modules/y`).
- **`logic/` never imports `infra/` or `api/`**, nor Node I/O, `node:sqlite`, Hono, the Agent SDK or `gh`.
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

A plan's state section names its changes in these terms:

- **Module**: one of the six, by name.
- **Port**: an interface `logic/` declares. **Adapter**: its `infra/` implementation.
- **Use case**: a `logic/` function or class the api layer calls.
- **Route / SSE stream / MCP tool / bus subscription**: an `api/` adapter.
- **Bus event**: a typed announcement on the shared bus, with its payload.
- **Public call**: a function exported from a module's `index.ts`.
- **Table + migration**: SQLite state, with its owning module.
- **View**: a React SPA screen or component. **Bridge page**: a kit-element HTML page under `.aisf/artifacts`.

Confirm-page lanes, left to right: **UI** (views, bridge pages) · **api** · **logic** · **infra** · **GitHub / Claude** (external systems).

## UI

**Yes.** Surfaces:

- **The React SPA** (`packages/ui`): project board, ticket pages, "Needs you", run transcripts, Known bugs, and settings. It reads the `ui` module's JSON API and SSE.
- **Bridge pages**: HTML the sessions write under `.aisf/artifacts`, built from the `<aisf-*>` kit elements and styled only by `kit.css` tokens. The `bridge` module serves them.

## Easy-to-miss wiring

- **A new module** needs its `index.ts`, construction in `main.ts`, and a matching dependency-cruiser rule.
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
