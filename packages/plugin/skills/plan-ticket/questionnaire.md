# The bridge page

Every interview round and the Confirm gate live on **one bridge page per planning session**.
Build it with `aisf:artifacts` (read it and `references/elements.md` first) and show it with
`aisf_show_artifact`. Chat gets no questions.

- **Page id:** `plan-<n>`, in `.aisf/artifacts/plan-<n>/`. The ledger (`ledger.md`) and the
  findings log (`findings.md`) live in the same folder.
- **One `<aisf-round>` per grilling round.** Each question is an `<aisf-question>` with one
  `<aisf-card>` per option, the suggestion marked `suggested`.
- **Settled by precedent** is an `<aisf-precedent>` under the round's questions, one child per
  decision. The answer is `{answers, vetoes}`. A veto turns that decision into a question in
  the next round.
- **A question a step 7 spec subagent returns** goes on the same page as a further round.
- **Confirm** is the last `<aisf-confirm>` round: one `<aisf-task>` per sub-issue with its
  module and layer in `heading` and its `hitl` switch, and the decision tree from the ledger as `<aisf-tree-node>` rows. The answer
  carries `hitl` per task. Confirm locks them.
- **Next round:** edit the same `index.html`, then call `aisf_show_artifact` again with the
  same id.

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
  <aisf-card value="a" suggested why="one line of why" gain="its gain" cost="its cost"
    >Option A</aisf-card
  >
  <aisf-card value="b" gain="its gain" cost="its cost">Option B</aisf-card>
  <aisf-more>code excerpt by path, edge cases, research findings</aisf-more>
</aisf-question>
```

- `problem` holds the problem, `gain` and `cost` each option's consequence, `<aisf-more>`
  the depth. The kit adds Other and Discuss.

- **A figure is the default.** It shows each option, not only today's state: comparing the
  options is what the human decides on. Only a pure naming or wording choice goes without, and
  the card says why.
- **About 50 words of prose** outside the figure and **More**. Depth goes into **More**.
- **Every option carries its consequence**: one gain, one cost.

**Pick the figure by what is decided:**

| Decision about           | Figure                                                                          |
| ------------------------ | ------------------------------------------------------------------------------- |
| UI / UX                  | low-fi mockup, one per option (`aisf-context kind="mockup"`)                    |
| Flow, order of calls     | `aisf-sequence`                                                                 |
| State, lifecycle         | `aisf-state`                                                                    |
| Where code lives         | `aisf-modmap`, new and changed units marked                                     |
| Data shape, API, storage | `.aisf-diff`, before → after, by path                                           |
| Library                  | `table.aisf-table`: fit, size, upkeep, precedent                                |
| Scope                    | `.aisf-scope`, in / out                                                         |
| Options side by side     | `.aisf-compare` with one `.aisf-panel` per option                               |
| Anything else            | free SVG with `aisf-shape*`, `aisf-label`, `aisf-edge`                          |
| Playback, round 1        | each acceptance criterion as a flow over today's system, new and changed marked |
| Split proposal           | each part as a box: title, Context, Scope, its numbered criteria (A1, A2, B1 …) |
| `hitl` checkpoint        | the full checkpoint: what is set up, what the human does                        |

## Reading the answer

Read it as `aisf:artifacts` says (_Reading the answer_). Answer Discuss notes briefly in chat.
Earlier rounds freeze into read-only summaries: decision · answer · `assumes:`.

The page is a decision device: disposable, and never linked from GitHub.
