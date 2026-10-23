# The bridge page

Every interview round and the Confirm gate live on **one bridge page per planning session**.
Build it with `aisf:artifacts` (read it and `references/elements.md` first) and show it with
`aisf_show_artifact`. Chat gets no questions.

- **Page id:** `plan-<n>`, in `.aisf/artifacts/plan-<n>/`. The ledger (`ledger.md`) and the
  findings log (`findings.md`) live in the same folder.
- **The playback map sits above the first round**, the one element outside a round. See
  _The playback map_.
- **One `<aisf-round>` per grilling round.** Each question is an `<aisf-question>` with one
  `<aisf-card>` per option, the suggestion marked `suggested`.
- **Settled by precedent** is an `<aisf-precedent>` under the round's questions, one child per
  decision. The answer is `{answers, vetoes}`. A veto turns that decision into a question in
  the next round.
- **A question a step 7 spec subagent returns** goes on the same page as a further round.
- **Confirm** is the last `<aisf-confirm>` round: one `<aisf-task>` per sub-issue with its
  module and layer in `heading` and its `hitl` switch, and the decision tree from the ledger as `<aisf-tree-node>` rows. The answer
  carries `hitl` per task. Confirm locks them.
- **Next round:** redraw the playback map to match the decisions so far, add the round to the
  same `index.html`, then call `aisf_show_artifact` again with the same id.

## The playback map

The page's anchor: each acceptance criterion as a path through the code it touches. Build it
from `playback-example.html` (this folder), which is the example to follow. Redraw it from the
example for each ticket, and show whatever helps the human check the plan.

- **Above the rounds, in every round.** After each round, redraw it to match the decisions on
  the page. A changed path is not asked again.
- **The end state** of the ticket opens it, in two or three sentences.
- **Only the touched code.** One column per module the criteria touch, each split into its
  presentation, business and infrastructure layers. Inside each layer, only the components a
  path touches.
- **Wiring is not drawn.** Facades, adapters, event handlers and bus events go in the data's
  `WIRING` list. A call through them is one arrow between the two boxes it joins. The arrow
  keeps the first call and names any new or changed wiring it passed. A line under the
  criterion says so.
- **Frontend column first**, leftmost, when a criterion touches the UI: the touched screen
  parts, with no layer rows. Omit it otherwise.
- **Diff colours on every component**: `aisf-node-new`, `aisf-node-changed`,
  `aisf-node-untouched`.
- **Fold untouched modules.** A module whose touched components are all untouched starts as
  one folded box: its name, what it does for these paths in one or two domain words ("reads
  ticket"), and its step count. Its inner hops leave the map and the route sheet; the call into
  it stays one row. Clicking the box unfolds it. Unchanged steps inside a changed module stay
  drawn.
- **One path per criterion**, picked with `aisf-switch` buttons (AC1, AC2, …, All). The
  selected criterion's text sits directly under the buttons. Steps are numbered in call order
  and named by who starts them (the owner, GitHub). The path's end is marked. A route sheet
  under the map lists each step: from → to, and the call.
- **Arrows:** in on a box's left edge, out on its bottom edge. Each arrow is right-angled in
  its own lane, 10px from its neighbours: no shared segment, no shared endpoint. Each is drawn
  over a halo in the background colour. The last segment into a box is straight. A long lane
  carries its step number midway. No segment crosses a box: a drop stays in the gap under its
  box, and vertical runs use the gutters left of the boxes.
- **Layers keep their rows.** An empty layer stays as a blank row, so no box moves up into
  another layer's row.
- **Focus:** hovering a box lights it, its incoming and outgoing arrows, the boxes at their
  other ends and their route-sheet rows; the rest fades. Hovering one arrow lights only it,
  its two boxes and its row. Clicking pins the focus; clicking again releases it.
- **Generated, never hand-placed:** one data object holds modules, components and paths; the
  page script lays out boxes, routes the wires and computes the readout.
- **Full width.** The figure is `<aisf-figure wide>`: the map spans the window, with no
  maximum width.
- **Columns from the data.** The script sets the column widths from the modules shown: each
  module's share follows its longest box name. Never copy a fixed column template from the
  example; it fits only the example's modules. No column narrower than a box name; names break
  only at word joins. When the columns don't fit, the modules stack.
- **Check before showing:** view the map at about 1440 and 1920px wide. No empty column, no
  column much thinner than its neighbours.
- **Under the map, in round 1:** one question per criterion, `Correct` (`suggested`) or
  `Wrong path`, with its `assumes`.

## The card

One question per card. Each card is **self-contained**: someone who never saw the ticket answers
it without scrolling elsewhere. Every term is defined on the card or common knowledge. Supplying
the context is your job, never the human's.

```html
<aisf-question
  name="q3"
  heading="<title, phrased as the question>"
  problem="one line: what is decided, what goes wrong if decided badly"
>
  <aisf-context kind="diagram">…figure: one panel per option, changes marked…</aisf-context>
  <aisf-card
    value="a"
    suggested
    why="one line of why"
    gain="its gain"
    cost="its cost"
    effect="what it builds or changes: module · layer, table, sub-issues added"
    >Option A</aisf-card
  >
  <aisf-card value="b" gain="its gain" cost="its cost" effect="its effect">Option B</aisf-card>
  <aisf-more>code excerpt by path, edge cases, research findings</aisf-more>
</aisf-question>
```

- `problem` holds the problem, `gain`, `cost` and `effect` each option's consequence,
  `<aisf-more>` the depth. The kit adds Other and Discuss.

- **A figure is the default.** It shows each option, not only today's state: comparing the
  options is what the human decides on. Only a pure naming or wording choice goes without, and
  the card says why.
- **About 50 words of prose** outside the figure, the effect lines and **More**. Depth goes
  into **More**.
- **Every option carries its consequence**: one gain, one cost (`gain`, `cost`), and its
  effect (`effect`). The effect is fact only: what gets built or changed (module, layer,
  table), and how many sub-issues it adds or removes. A scope-extending option shows the added
  work there.
- **A necessary extension** opens its heading with `Extends scope:` and names the criterion
  that needs it in `problem` ("AC2 fails without it").

**Pick the figure by what is decided:**

| Decision about           | Figure                                                                          |
| ------------------------ | ------------------------------------------------------------------------------- |
| UI / UX                  | low-fi mockup, one per option (`aisf-context kind="mockup"`)                    |
| Flow, order of calls     | `aisf-sequence`                                                                 |
| State, lifecycle         | `aisf-state`                                                                    |
| Where code lives         | `aisf-modmap`, new and changed units marked                                     |
| Data shape, API, storage | `.aisf-diff`, before → after, by path                                           |
| Library                  | `table.aisf-table`: fit, size, upkeep, precedent                                |
| Options side by side     | `.aisf-compare` with one `.aisf-panel` per option                               |
| Anything else            | free SVG with `aisf-shape*`, `aisf-label`, `aisf-edge`                          |
| Necessary extension      | the criterion's path, with the forced extra work marked                         |
| Playback                 | the playback map (_The playback map_)                                           |
| Split proposal           | each part as a box: title, Context, Scope, its numbered criteria (A1, A2, B1 …) |
| `hitl` checkpoint        | the full checkpoint: what is set up, what the human does                        |

## Reading the answer

Read it as `aisf:artifacts` says (_Reading the answer_). Answer Discuss notes briefly in chat.
Earlier rounds freeze into read-only summaries: decision · answer · `assumes:`.

The page is a decision device: disposable, and never linked from GitHub.
