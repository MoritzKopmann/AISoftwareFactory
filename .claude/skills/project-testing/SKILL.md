---
name: project-testing
description: >
  AISoftwareFactory testing reference: vitest mechanics, test layout and naming, fakes and
  fixtures, and which changes aren't unit-testable. Use when writing, placing or running tests.
user-invocable: false
---

## Scope

Testing in this repo, and rendering a component to PNG.

Done: you know how to run, place, name and fake a test here, and how to render a `packages/ui` component.

## Mechanics (ME)

- **ME1 Must:** use vitest, configured at the root (`vitest.config.ts`) with one project per code package: `packages/app`, `packages/ui` and `packages/plugin`. Run a file with `test_file` and the suite with `test` from `project-toolchain`.
- **ME2 Must:** import explicitly: `import { describe, expect, it } from 'vitest'`. No globals.
- **ME3 Must:** write `packages/plugin` scripts and their tests as plain `.mjs`, named `<subject>.test.mjs` and placed beside the script. They are linted and formatted, not type-checked.
- **ME4 Must:** write tests in TypeScript under the same strict `tsconfig` as the code they test. `analyze` type-checks them too.
- **ME5 Must:** keep unit tests in the process: no network, no GitHub, no `gh`, no `claude` subprocess, no real `~/.aisf`. Those sit behind ports and are faked (see `## Fakes and fixtures (FF)`).

What gets tested where:

- `business/`: most tests. Services against hand-written fakes of their interfaces.
- `infrastructure/`: repositories against a real `node:sqlite` database in a temp dir. Adapters to `gh` and the SDK are thin and are covered by the smoke checks below, not by unit tests.
- An adapter over another module (`infrastructure/internal/`) is unit-tested when it reshapes or maps errors, against a hand-written fake of the producer's `Pick` in `modules/<consumer>/testing/`. A pure forward is not.
- `presentation/`: Hono routes through `app.request()`, with the module's services behind fakes.
- `modules/<m>/<m>.module.test.ts`: the module wired through its `index.ts`.
- `packages/ui`: component logic and state. Visual layout is not unit-tested.

Not unit-testable here, and the proof that replaces a failing test first:

| Change | Proof instead |
|---|---|
| Toolchain and config: `package.json` scripts, `tsconfig`, ESLint, Prettier, vitest, CI workflow | `format`, `analyze` and `test` from `project-toolchain` all green |
| A dependency-cruiser rule | A checked-in violating example or fixture that `analyze` rejects |
| Composition-root wiring in `composition-root.ts` and `main.ts` | The server boots and serves, checked at Verify AC |
| Pure SPA layout or styling, `kit.css` tokens | Checked in the running app at Verify AC |
| Skill and agent content under `packages/plugin` or `.claude/skills` | A hand run of the skill, checked at Verify AC |
| An `infrastructure/` adapter that only forwards to `gh`, `claude` or the SDK | The `skills` smoke probe or a hand run, checked at Verify AC |

- **ME6 Must:** give anything not in this table a failing test first.

## Layout and naming (LN)

- **LN1 Must:** place a test next to its subject, named `<subject>.test.ts`:
  `packages/app/src/modules/scheduler/business/service/start-run.service.ts` → `packages/app/src/modules/scheduler/business/service/start-run.service.test.ts`
- **LN2 Must:** name a module test `modules/<m>/<m>.module.test.ts`.
- **LN3 Must:** put fakes and fixtures in `testing/` folders: a module's in `modules/<m>/testing/` (fixtures in `testing/fixtures/`), shared ones in `packages/app/src/shared/testing/`. The build (`tsconfig.build.json`) leaves out `*.test.ts` and `testing/`.
  - **Exception:** kit tests stay in `packages/app/test/assets/kit/`, because `assets/kit` is served statically.
- **LN4 Must:** use one `describe` per subject, named after it. Nested `describe` only per public function or method.
- **LN5 Must:** name every test `should <X> when <Y>`: `X` is the asserted outcome, `Y` the trigger or condition. Lowercase `should`, no "test" suffix.
  - `it('should queue the run when another run is active for the project', …)`
  - `it('should emit snapshot.changed when a label differs', …)`
  - `it('should return 404 when the ticket is unknown', …)`
- **LN6 Must:** give a test body three blocks, arrange, act and assert, each separated by one blank line.
- **LN7 Should:** test the boundaries: empty, zero, one, the limit and one past it.

## Fakes and fixtures (FF)

- **FF1 Must:** hand-write fakes as classes or objects implementing the interface, kept in `testing/`: `modules/<m>/testing/` for one module, `shared/testing/` when shared. A fake records calls and returns scripted results.
- **FF2 Must:** mock no module. No `vi.mock` of our own files or of libraries. If a test needs to replace something, it should be an interface. `vi.fn()` is fine as a callback spy.
- **FF3 Must:** treat time as an interface. Services take a clock, so tests never sleep and never depend on the wall clock. `vi.useFakeTimers()` only for code that genuinely schedules timers.
- **FF4 Must:** give each test that needs SQLite a fresh database in a temp dir via `shared/config`'s overridable home, with migrations applied. Remove it in `afterEach`.
- **FF5 Must:** record GitHub payloads as JSON under `testing/fixtures/github/` of the module that reads them.
- **FF6 Must:** record SDK messages and transcripts as JSONL under `testing/fixtures/sessions/` of the module that reads them.
- **FF7 Should:** build a test's data with a named builder in `testing/` that takes only the fields the test cares about: `aReadyTicket({ priority: 'high' })`, not a 30-field literal.
- **FF8 Must:** use the real `InMemoryEventBus` from `shared/` for the bus in tests. It has no I/O, so it isn't faked.
  - **Exception:** until a module migrates, its tests, fakes and fixtures stay in `packages/app/test/` in the old layout (`logic/`, `infra/`, `api/`).

## Hand checks (HC)

Hand checks in the running app run on the GitHub repo `MoritzKopmann/test-project`.

## Steps

### Visual rendering

Render one `packages/ui` component to PNG: a throwaway Vite page plus headless Chrome. No new
dependency.

#### 1. Set up the render target

- **Goal:** a harness in `packages/ui/.aisf/render/`. `.aisf/` is gitignored, so it is never committed.
- **Actions:** create three parts:
  - `aisf`: a symlink to the kit, so `/aisf/kit.css` and `/aisf/fonts/…` resolve as in the app:
    `ln -s ../../../app/assets/kit packages/ui/.aisf/render/aisf`
  - `index.html`:

    ```html
    <!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <link rel="stylesheet" href="/aisf/kit.css" />
      </head>
      <body>
        <div id="root"></div>
        <script type="module" src="./render.tsx"></script>
      </body>
    </html>
    ```

  - `render.tsx`: imports `../../src/app.css` and the component, reads `theme` and `state` from
    the query string, and mounts the component with that state's props in a box of the real
    width:

    ```tsx
    import { createRoot } from 'react-dom/client';
    import '../../src/app.css';
    import { HeldStatus } from '../../src/tickets/held-status.js';

    const params = new URLSearchParams(location.search);
    document.documentElement.dataset.theme = params.get('theme') ?? 'light';
    const states = {
      default: <HeldStatus />,
      timed: <HeldStatus heldUntilLabel="14:30" />,
    };
    const state = (params.get('state') ?? 'default') as keyof typeof states;

    createRoot(document.getElementById('root')!).render(
      <div style={{ width: 824, padding: 16 }}>{states[state]}</div>,
    );
    ```

    One entry in `states` per state the leaf lists.
- **Note:** mount the component that takes its state as props. One that fetches has no API here: render its view with each described state instead.
- **Done:** `aisf`, `index.html` and `render.tsx` exist in `packages/ui/.aisf/render/`.
- **Exits:** done → 2.

#### 2. Start Vite

- **Actions:** start Vite from `packages/ui`, in the background:

      npx vite .aisf/render --config vite.config.ts --port 5199 --strictPort

- **Done:** Vite listens on port 5199.
- **Exits:** done → 3.

#### 3. Render each state × theme

- **Actions:** one PNG per state and theme. The window is the box width plus padding, and tall enough for the state:

      google-chrome --headless --disable-gpu --hide-scrollbars --window-size=856,400 --virtual-time-budget=3000 --screenshot=<abs path>.png "http://localhost:5199/?state=<state>&theme=<theme>"

  The mock renders the same way: `file://<abs path to the mock>` in place of the URL.
- **Themes:** `?theme=light` and `?theme=dark` set `data-theme` on `<html>`. `kit.css` and `app.css` both key dark mode on it.
- **Notes:**
  - Keep `--virtual-time-budget`: without it, the PNG can be taken before the kit fonts load.
  - `--screenshot` captures the window only. Too short cuts the component; too tall leaves `--bg` below it.
  - Chrome renders at 1×, so 1 px in the PNG is 1 CSS px.
  - Pass one plain absolute path to `--screenshot`. A shell variable in the command can trip the sandbox check of an isolated session.
- **Done:** one PNG exists per state and theme.
- **Exits:** done → 4.

#### 4. Stop Vite

- **Actions:** stop the Vite process from step 2.
- **Done:** port 5199 is free.
- **Exits:** done → done.

## Load also

None yet.
