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
  decision. Each row carries `source` (what settled it) and `how` (how it settled it). The answer is `{answers, vetoes}`. A veto turns that decision into a question in
  the next round.
- **A question a step 7 spec subagent returns** goes on the same page as a further round.
- **Confirm** is the last `<aisf-confirm>` round: one `<aisf-task>` per sub-issue with its
  module and layer in `heading` and its `hitl` switch, and the decision tree from the ledger as `<aisf-tree-node>` rows. The answer
  carries `hitl` per task. Confirm locks them.
- **Next round:** update the playback data to match the decisions so far, add the round to the
  same `index.html`, then call `aisf_show_artifact` again with the same id.

## The playback map

The page's anchor: each acceptance criterion as a path through the code it touches. You write
**data only**. The kit draws the map, its wires and the route sheet. Copy the shape from
`playback-example.html` (this folder): one `<aisf-playback>` with one JSON child, replace its
content for each ticket. The data contract is the `<aisf-playback>` section of
`../artifacts/references/elements.md`; read it, don't restate it here.

- **Above the rounds, in every round.** After each round, update the playback data to match the
  decisions on the page. A changed path is not asked again.
- **The end state** of the ticket opens it, in two or three sentences, above the element.
- **One block per affected public fn**, in `classes[].fns`. List every interface a path calls:
  controller, facade, use case, handler, adapter, repository. The event bus is a module whose
  fn is the event. Never list private methods or helpers. An adapter does not name its port.
  No separate list of facades or adapters.
- **`does`** says what the fn must do for this ticket. Aim for 100 characters or less. The kit
  does not enforce it.
- **`mark`** is `new`, `changed`, `untouched` or `removed`. Every fn that is not `new` names its
  `source`, the code path it lives at. A text that rests on an open question sets
  `pending: "Q<n>"`.
- **Untouched code on a path** is listed with a short role text. A module whose classes are all
  untouched folds by itself.
- **Frontend module first**, when a criterion touches the UI: `kind: "frontend"`, its classes
  carry `layer: null`. Omit it otherwise.
- **`criteria`**: one entry per acceptance criterion, with its `paths`. A path has exactly one
  starting point, an actor or trigger (`actor`, and a first step whose `from` is `null`). A
  criterion with two or more starting points gets one path each. A branch inside a fn is not a
  second path: it goes in that fn's `does`.
- **Escape `<` as `\u003c`** in every text. A raw `</script` ends the script tag early.
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
  `<aisf-more>` the depth. The kit adds one free text field.

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
| Flow, order of calls     | call order, new calls marked                                                    |
| State, lifecycle         | states and the moves between them, new moves marked                             |
| Where code lives         | modules and layers, new and changed units marked                                |
| Data shape, API, storage | before → after, by path                                                         |
| Library                  | a table: fit, size, upkeep, precedent                                           |
| Options side by side     | one panel per option, side by side                                              |
| Anything else            | a free drawing of the mechanism                                                 |
| Necessary extension      | the criterion's path, with the forced extra work marked                         |
| Playback                 | the playback map (_The playback map_)                                           |
| Split proposal           | each part as a box: title, Context, Scope, its numbered criteria (A1, A2, B1 …) |
| `hitl` checkpoint        | the full checkpoint: what is set up, what the human does                        |

## Reading the answer

Read it as `aisf:artifacts` says (_Reading the answer_). Answer a free text answer (`choice` is `text`) briefly in chat.
Earlier rounds freeze into read-only summaries: decision · answer · `assumes:`.

The page is a decision device: disposable, and never linked from GitHub.
