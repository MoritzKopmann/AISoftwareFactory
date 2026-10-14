---
name: project-testing
description: >
  AISoftwareFactory testing reference: vitest mechanics, test layout and naming, fakes and
  fixtures, and which changes aren't unit-testable. Use when writing, placing or running tests.
user-invocable: false
---

## Mechanics

- **Runner:** vitest, configured at the root (`vitest.config.ts`) with one project per code package: `packages/app` and `packages/ui`. Run a file with `test_file` and the suite with `test` from `project-toolchain`.
- **Imports are explicit:** `import { describe, expect, it } from 'vitest'`. No globals.
- Tests are TypeScript under the same strict `tsconfig` as the code they test. `analyze` type-checks them too.
- **Unit tests never leave the process:** no network, no GitHub, no `gh`, no `claude` subprocess, no real `~/.aisf`. Those sit behind ports and are faked (see `## Fakes and fixtures`).
- **What gets tested where:**
  - `business/`: most tests. Services against hand-written fakes of their interfaces.
  - `infrastructure/`: repositories against a real `node:sqlite` database in a temp dir. Adapters to `gh` and the SDK are thin and are covered by the smoke checks below, not by unit tests.
  - An adapter over another module (`infrastructure/internal/`) is unit-tested when it reshapes or maps errors, against a hand-written fake of the producer's `Pick` in `modules/<consumer>/testing/`. A pure forward is not.
  - `presentation/`: Hono routes through `app.request()`, with the module's services behind fakes.
  - `modules/<m>/<m>.module.test.ts`: the module wired through its `index.ts`.
  - `packages/ui`: component logic and state. Visual layout is not unit-tested.

**Not unit-testable here, and the proof that replaces a failing test first:**

| Change | Proof instead |
|---|---|
| Toolchain and config: `package.json` scripts, `tsconfig`, ESLint, Prettier, vitest, CI workflow | `format`, `analyze` and `test` from `project-toolchain` all green |
| A dependency-cruiser rule | A checked-in violating example or fixture that `analyze` rejects |
| Composition-root wiring in `composition-root.ts` and `main.ts` | The server boots and serves, checked at Verify AC |
| Pure SPA layout or styling, `kit.css` tokens | Checked in the running app at Verify AC |
| Skill and agent content under `packages/plugin` or `.claude/skills` | A hand run of the skill, checked at Verify AC |
| An `infrastructure/` adapter that only forwards to `gh`, `claude` or the SDK | The `skills` smoke probe or a hand run, checked at Verify AC |

Anything not in this table gets a failing test first.

## Layout and naming

- A test sits next to its subject, named `<subject>.test.ts`:
  `packages/app/src/modules/scheduler/business/service/start-run.service.ts` → `packages/app/src/modules/scheduler/business/service/start-run.service.test.ts`
- A module test is `modules/<m>/<m>.module.test.ts`.
- Fakes and fixtures sit in `testing/` folders: a module's in `modules/<m>/testing/` (fixtures in `testing/fixtures/`), shared ones in `packages/app/src/shared/testing/`. The build (`tsconfig.build.json`) leaves out `*.test.ts` and `testing/`.
- **Named exception:** kit tests stay in `packages/app/test/assets/kit/`, because `assets/kit` is served statically.
- One `describe` per subject, named after it. Nested `describe` only per public function or method.
- Name every test `should <X> when <Y>`: `X` is the asserted outcome, `Y` the trigger or condition. Lowercase `should`, no "test" suffix.
  - `it('should queue the run when another run is active for the project', …)`
  - `it('should emit snapshot.changed when a label differs', …)`
  - `it('should return 404 when the ticket is unknown', …)`

## Fakes and fixtures

- **Fakes are hand-written** classes or objects implementing the interface, kept in `testing/`: `modules/<m>/testing/` for one module, `shared/testing/` when shared. A fake records calls and returns scripted results.
- **Don't mock modules.** No `vi.mock` of our own files or of libraries. If a test needs to replace something, it should be an interface. `vi.fn()` is fine as a callback spy.
- **Time is an interface too.** Services take a clock, so tests never sleep and never depend on the wall clock. `vi.useFakeTimers()` only for code that genuinely schedules timers.
- **SQLite:** each test that needs it gets a fresh database in a temp dir via `shared/config`'s overridable home, with migrations applied. Removed in `afterEach`.
- **GitHub payloads:** recorded JSON under `testing/fixtures/github/` of the module that reads them.
- **SDK messages and transcripts:** recorded JSONL under `testing/fixtures/sessions/` of the module that reads them.
- The bus in tests is the real `InMemoryEventBus` from `shared/`. It has no I/O, so it isn't faked.
- **Until a module migrates,** its tests, fakes and fixtures stay in `packages/app/test/` in the old layout (`logic/`, `infra/`, `api/`).

## Load also

None yet.
