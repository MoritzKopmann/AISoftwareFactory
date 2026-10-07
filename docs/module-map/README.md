# Module map

An interactive map of every `packages/app` module: its public interface, its use cases grouped by domain, its infra, and every line between them.

- **Live page:** <https://claude.ai/artifact/E3bqb9G5TzTAixKQ15X4Tk> (private, owner only)
- **Snapshot of:** `main` at `9a40605`, 2026-10-07
- **Built by:** Claude Code in one session, over three review rounds with the human
- **Status:** hand-made. The data is not generated from code. It goes stale when the wiring changes.

## Files

| File                     | What it is                                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| `src/graph.json`         | The modules, their interface methods, use cases and infra, and all edges. Extracted once from the code.                                |
| `src/review.json`        | Domain groups per module, decision badges and the decision list. Hand-written during the review.                                       |
| `src/layout.js`          | `buildLayout(graph, review)`: pure function, computes every box position and line path.                                                |
| `src/page-template.html` | Page shell: styles, legend, decision table, notes, render and click code. Has 3 placeholders: `/*LAYOUT*/`, `/*GRAPH*/`, `/*REVIEW*/`. |
| `build.mjs`              | Fills the placeholders, writes one self-contained HTML file.                                                                           |
| `check.mjs`              | Checks for overlapping line segments, then runs the built page in jsdom and counts boxes, lines, domains and script errors.            |

## Rebuild and publish

```bash
node docs/module-map/build.mjs            # writes $TMPDIR/aisf-module-map.html (or pass a path)
node docs/module-map/check.mjs            # exit 1 on overlaps or script errors
```

The HTML runs standalone in any browser. To update the live page, publish the built file to the artifact URL above with Claude Code's Artifact tool.

## What it shows

### Layout

```
          projects   skills   watcher   scheduler   runner   bridge   findings
Public interface   [list()] [start()] …                              ← row 1
  Calls channel     ─── tracks ───                                  ← lines only
  Events · internal ─── tracks ───                                  ← lines only
Use cases        ┌ Registration ┐ ┌ Start-up checks ┐ …             ← row 2, in domain boxes
  Uses channel      ─── tracks ───                                  ← lines only
Infra            [SqliteProjectRepository] [GhCliLabelSync] …       ← row 3
```

- **One column per module**, in this order: `projects`, `skills`, `watcher`, `scheduler`, `runner`, `bridge`, `findings`. This is roughly the call direction, with `runner` in the middle because most calls end there.
- **Three rows.** Every item of a row sits on one horizontal line, so the sheet is wide (~8150 px) and scrolls sideways. This was a deliberate choice for fewer overlaps.
- **Domain boxes**: dashed boxes group a module's use cases. The names are a first proposal from the review, not a code concept.

### Boxes

| Row              | Box                                                              | Notes                                                                                                |
| ---------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Public interface | one per method on the module's `index.ts` interface              | `tools (MCP)` stands for the module's MCP tools. A dashed border means no use case backs the method. |
| Use cases        | one per class in `logic/use-cases/`                              | Name without the `UseCase` suffix, wrapped at camel-case boundaries. Clickable.                      |
| Infra            | one per class in `infra/integrations/` and `infra/repositories/` | A sub-line shows the port it implements, or `SQLite · <table>` for repositories (blue border).       |

### Lines

| Kind     | Look          | From → to                                  | Meaning                                                                                |
| -------- | ------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- |
| uses     | solid blue    | use case → infra                           | A constructor dependency on a port, filled in `main.ts` by that infra class.           |
| calls    | solid orange  | use case → other module's interface method | The use case's own port is filled in `main.ts` with that method (usually by a lambda). |
| backs    | dotted orange | interface method → use case                | The use case behind the method. Completes the chain _use case → interface → use case_. |
| internal | solid grey    | use case → use case, same module           | One use case is handed another (or its `execute`).                                     |
| event    | dashed purple | emitting use case → handling use case      | A bus event. The handler is the use case its subscription calls.                       |

### Interaction

- **Click a use case** to highlight its outgoing lines and their targets; everything else dims. For each `calls` line, the matching `backs` line and the use case behind it light up too. The trace stops there and does not follow further.
- Port and event names appear on the lit lines.
- Clicking the same box again, clicking the background, Esc or the Clear button resets the view.
- Hover a box or line for its full name, port or event.

### Decisions

Badges `D1`–`D8` on boxes and on a module name point to the decision table under the map:

- orange = decided
- blue outline = proposed
- dashed = open

The table links each decision to its ticket (#328–#331).

## How it was made

### Conversation flow

| Round | Human asked                                                                                                         | What it added                                                         |
| ----- | ------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| 0     | How locked are the modules? Which could be split?                                                                   | Read `project-architecture` and the 7 modules. Verdict: no split due. |
| 1     | Build a map: use cases in one row, integrations below, lines for use and for cross-module calls, click to highlight | The first map                                                         |
| 2     | Questions about single use cases and infra; group use cases by domain                                               | Domain boxes, badges, decision table                                  |
| 3     | Accept decisions, create tickets                                                                                    | Ticket links in the table                                             |

### Decisions that shaped the page

All asked and answered before building.

| Question                            | Answer                                                                         |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| Where does a cross-module line end? | As a chain: use case → interface method → the use case behind it               |
| What goes in the lower row?         | Integrations and SQLite repositories. Repositories mark table ownership.       |
| Show bus events?                    | Yes, as dashed lines labelled with the event name                              |
| Layout?                             | Module columns side by side                                                    |
| Where do interface methods sit?     | Top row of each column                                                         |
| How far does a click highlight?     | Direct lines plus the full call chain, stopping at the target use case         |
| Same-module use-case calls?         | Yes, drawn as lines                                                            |
| Overlaps?                           | Lines must not lie on each other. Spread the view; sideways scrolling is fine. |
| Domain boxes?                       | Inside each module. Claude proposes the names.                                 |
| Show agreed changes?                | Current code, with agreed changes marked as badges                             |
| Where do decisions live?            | In chat and in a table on the page                                             |

### Visual decisions made by Claude

- The app's own "Drafting" tokens from `packages/app/assets/kit/kit.css` (light and dark), and its fonts: Atkinson Hyperlegible Next for text, JetBrains Mono for names. Both load from Google Fonts.
- A faint drafting grid behind the sheet.
- Orthogonal lines with rounded corners and small arrowheads.

## Data

### `graph.json`

```jsonc
{
  "modules": [
    {
      "name": "runner",
      "interface": [
        { "id": "runner.if.start", "name": "start", "useCase": "runner.uc.StartRunUseCase" },
      ],
      "useCases": [{ "id": "runner.uc.StartRunUseCase", "name": "StartRunUseCase" }],
      "infra": [
        {
          "id": "runner.infra.GitCliWorktrees",
          "name": "GitCliWorktrees",
          "kind": "integration",
          "port": "Worktrees",
        },
      ], // repositories add "table"
    },
  ],
  "edges": [
    { "from": "<use case>", "to": "<infra>", "kind": "uses", "via": "<port>" },
    { "from": "<use case>", "to": "<interface>", "kind": "calls", "via": "<own port>" },
    { "from": "<use case>", "to": "<use case>", "kind": "internal", "via": "<dependency>" },
    { "from": "<use case>", "to": "<use case>", "kind": "event", "event": "run.finished" },
  ],
  "notes": ["…ambiguities found during extraction…"],
}
```

`backs` lines are not stored. The layout derives them from `interface[].useCase`.

Counts at `9a40605`:

- 7 modules
- 23 interface methods
- 44 use cases
- 24 infra: 20 integrations, 4 repositories
- 115 edges: 60 uses, 34 calls, 11 internal, 10 event

### How the graph was extracted

One read-only Claude subagent read the code and wrote the edges by hand. No parser was involved. Its rules:

1. **Use cases, ports and infra** come from the module folders.
2. **Interface methods** come from each `index.ts`, together with the use case behind each one.
3. **uses**: a use case's constructor dependencies, matched to the infra class `main.ts` puts into that port.
4. **calls**: a port that `main.ts` fills with another module's interface method (directly or through a lambda). A port that maps to several methods gives one edge per method. Only methods the use case actually calls are counted.
5. **internal**: a use case handed another use case of the same module.
6. **event**: every `emit(` inside a use case, matched to the `api/subscriptions` handler and the use case it calls.
7. **Skipped**: shared adapters (clock, bus, logger, identifiers), helper files without a class (`map-sdk-message`, `run-gh-command`, `run-claude`, `request-github`), and routes.

It was spot-checked against the code (`StartTicketRunUseCase` dependencies; all 9 `emit(` sites).

Things the map simplifies (also listed on the page):

- Watcher's subscriptions to `project.added`, `run.finished` and `ticket.status-written` update in-memory state, then request a poll. Their lines end at `PollRepositories`.
- `skills.start` runs 2 use cases (`StartSkills` and `ReadCredentials`), but only `StartSkills` is linked.
- `tools (MCP)` of bridge and findings go into `LaunchRunSession`. The agent session calls them, not the use case.
- `GhCliGitHubToken` is used only by other infra, so it has no line.
- Watcher's `RegisteredRepositories` calls `projects.list` from `index.ts`, not from a use case, so it has no line.

### `review.json`

- `domains`: per module, an ordered list of `{ name, useCases: [class names] }`. The order sets the left-to-right order.
- `badges`: node id (or `module.<name>`) → decision id.
- `decisions`: `{ id, status: decided|proposed|open, title, step, ticket? }`.

## Layout algorithm

`buildLayout` is pure: data in, coordinates and SVG path strings out. That is why `check.mjs` can test it without a browser.

1. **Order inside a module.**
   - Use cases are sorted by domain first. Inside a domain they follow their average infra position, which shortens the lines to infra.
   - Infra is then sorted by the average position of the use cases that use it.
   - Interface methods are sorted by the position of their use case.
2. **Slots.**
   - Every box is 136 px wide in a 156 px slot.
   - Domains get a 30 px gap between them, modules a 56 px gap.
   - A module's width is its widest row. The other rows are centred in it.
3. **Channels.** Lines never run through a row; they run in the horizontal channels between rows:
   - _Calls_, between the interface row and the use cases: calls and backs lines.
   - _Events · internal_, just above the use cases: event and internal lines.
   - _Uses_, between the use cases and infra: uses lines.
4. **Ports.**
   - Each line end gets its own attach point on the box edge. The points on one edge are spread evenly and sorted by where the other end is, which avoids crossings at the box.
   - Interface ports shift 7 px right and infra ports 7 px left, so they don't line up with the use case ports in the same slot.
   - A final pass keeps all ports of one channel region at least 4 px apart.
5. **Tracks.**
   - Every line is three segments: down/up into its channel, along a horizontal track, then into the target.
   - Tracks are assigned by greedy interval colouring: a line reuses a track if its span starts more than 12 px after the track's last line ends.
   - Tracks are 9 px apart. Each channel's height comes from its track count.
6. **Paths.** The polyline gets 5 px rounded corners. Arrowheads are SVG markers, one per line kind.

**Result:** lines cross but never lie on top of each other. `check.mjs` verifies this. Without the port shift and the 4 px pass, there were 8 overlaps.

## Known limits

- **Manual data.** A new use case, port or wiring in `main.ts` does not appear until `graph.json` is updated.
- **Domain names are proposals** and live only in `review.json`, not in code.
- **Only outgoing lines are highlighted.** Clicking does not show who calls the selected use case.
- **Only use cases are clickable.** Interface and infra boxes are not.
- **Sideways scrolling** is the trade-off for no overlaps. There is no zoom.

## Toward an app feature

Notes for turning this into a feature. They are opinions, not decisions.

- **Extraction is the hard part.** Layout and rendering are already pure and data-driven.
  - Most of the graph follows from the class-type rules in `project-architecture`: folder = type, constructor = dependencies, `index.ts` = interface.
  - The TypeScript compiler API could read constructor dependency types and `main.ts`'s `build<Name>Module` calls.
  - Lambdas in `main.ts` that fill a port with another module's method are the hardest case. They need a call-site walk.
- **Reuse:** `buildLayout` and the graph schema can stay as they are; only `graph.json` would be generated.
- **Domains and decisions** are human input. They would need their own store, unless they come from code: for example a domain folder level, or ADRs.
- **Token cost:** generating the graph with code costs no model tokens. The subagent extraction used ~98k tokens for one snapshot.
