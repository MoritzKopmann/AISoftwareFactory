# The questionnaire page

Every interview round and the Confirm gate live on **one published page per planning session**.
Chat gets the link only. Load `artifact-design` and `artifact-capabilities`, and
`artifact-diagramming` for the figures. Declare `capabilities: {artifact: {}}`. Design freely:
only this contract is fixed.

## The card

One card per question. Each card is **self-contained**: someone who never saw the ticket answers
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
| `hitl` checkpoint        | the full checkpoint: what is set up, what the human does                        |

## Settled by precedent

A section under each round's cards: the decisions settled by precedent, one line each:
decision · source (path or symbol) · **Veto** with a note. A veto turns it into a card next
round.

## Saving

**Submit** unlocks once every card is answered. **Accept all remaining** fills the open cards
with the suggestion. Submit saves the answers and vetoes as data in the page, through
`artifact.publish`. **Copy answers** exports `Q<n> · <title> · <answer> · note: …` as a
fallback.

**Read the answers** from the republish notice if the publish result confirmed a watch, else
`read` the page, or take the pasted export. Answer Discuss notes briefly in chat.

## Rounds

**The next round** goes on the same page, in focus. Earlier rounds freeze into read-only
summaries: decision · answer · `assumes:`. Reopening one goes through chat or a note.

**Confirm** is the last section, after the final round: the step 6 table, a diagram only where
it shows the split better than the table, and **Confirm** and **Reopen** (with a note), which
save like Submit.

The page is a decision device: disposable, and never linked from GitHub.
