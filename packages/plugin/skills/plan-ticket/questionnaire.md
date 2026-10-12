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
  `hitl` switch, and the decision tree from the ledger as `<aisf-tree-node>` rows. The answer
  carries `hitl` per task. Confirm locks them.
- **Next round:** edit the same `index.html`, then call `aisf_show_artifact` again with the
  same id.

## The card

One question per card. Each card is **self-contained**: someone who never saw the ticket answers
it without scrolling elsewhere. Every term is defined on the card or common knowledge. Supplying
the context is your job, never the human's.

```
┌ Q3 · <title, phrased as the question>
│ Problem   one or two lines: what is decided, what goes wrong if it is decided badly
│ ┌─────────────── figure ───────────────┐
│ │ now   →   option A   |   option B     │   one panel per option, changes marked
│ └───────────────────────────────────────┘
│ ○ A  <option>  ★ suggested: one line of why     + gain   − cost
│ ○ B  <option>                                   + gain   − cost
│ ○ free text      ○ Discuss [note]
│ ▸ More (collapsed): code excerpt by path, edge cases, research findings
└
```

- **A figure is the default.** It shows each option, not only today's state: comparing the
  options is what the human decides on. Only a pure naming or wording choice goes without, and
  the card says why.
- **About 50 words of prose** outside the figure and **More**. Depth goes into **More**.
- **Every option carries its consequence**: one gain, one cost.

**Pick the figure by what is decided:**

| Decision about           | Figure                                                                          |
| ------------------------ | ------------------------------------------------------------------------------- |
| UI / UX                  | low-fi mockup, one per option                                                   |
| Flow, order of calls     | sequence or flow diagram                                                        |
| State, lifecycle         | state diagram                                                                   |
| Where code lives         | module map, new and changed nodes marked                                        |
| Data shape, API, storage | before → after schema or snippet, by path                                       |
| Library                  | comparison table: fit, size, upkeep, precedent                                  |
| Scope                    | in / out, two columns                                                           |
| Playback, round 1        | each acceptance criterion as a flow over today's system, new and changed marked |
| Split proposal           | each part as a box: title, Context, Scope, its numbered criteria (A1, A2, B1 …) |
| `hitl` checkpoint        | the full checkpoint: what is set up, what the human does                        |

## Reading the answer

Read it as `aisf:artifacts` says (_Reading the answer_). Answer Discuss notes briefly in chat.
Earlier rounds freeze into read-only summaries: decision · answer · `assumes:`.

The page is a decision device: disposable, and never linked from GitHub.
