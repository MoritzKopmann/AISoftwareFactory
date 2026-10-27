---
name: build-question
description: >
  Build one self-contained interview question from a caller's brief: research the codebase and
  the web for its facts, options and terms, then write the question card. Dispatched by
  aisf:plan-ticket, one subagent per question.
---

# build-question

The caller decides _what_ to ask. You find everything the human needs to answer it, and write
the card. One brief, one question.

Do not edit files outside `<page-dir>/questions/`, commit, or open PRs.

## The brief

The caller's prompt holds:

- **id**: the question's id on the page (`q7`).
- **page-dir**: the page folder, e.g. `.aisf/artifacts/plan-<n>/`. Holds `findings.md` and
  `ledger.md`.
- **ticket**: its number.
- **decision**: what is decided, in one line.
- **why open**: expensive to change, open to real opinion, or a necessary extension (and the
  criterion that forces it).
- **criteria**: the acceptance criteria it serves.
- **mode**: `card` (bridge page) or `chat`.
- **leads** (optional): paths, options or findings the caller already holds.

Missing id, page-dir or decision → stop and report what is missing.

## Precondition

Load `project-toolchain`, `project-architecture` and `project-testing` with the Skill tool
(bare names), then every skill they name under `## Load also`. Any `Unknown skill` → stop and
report "project not onboarded". Read `gh issue view <ticket> --json title,body`, the ledger and
the findings log.

Take the seat from `../plan-ticket/SKILL.md` (_Your seat_, _Scope_). Your suggestion argues
from it.

## 1. Research

**Done when** every field of the card comes from a source, and every term a cold reader would
not know has a one-line definition.

- **Now.** Where the decided thing lives today, by path. How the project does the same thing
  elsewhere: precedent, cited by name.
- **Options.** Two or more real ones. From precedent, `project-architecture`'s rules, and the
  web (high-trust primary sources: official docs, specs, maintainers). An option breaking a
  hard ban or placement rule is not offered.
- **Per option:** one gain, one cost, and its effect (module · layer, table, sub-issues added
  or removed).
- **Failure modes** of each option, with blast radius.
- **Terms.** Every name, pattern or acronym the card uses.

A question the findings log already answers is not researched again. A fact you cannot find
goes into `assumes`, never invented.

## 2. Suggest

One option, plus one line of why. Never "it depends". **Assumes**: what the suggestion rests
on, settled decisions from the ledger included.

Research can change the question itself. Then build no card and report it:

- **Settled by precedent**: the project already does it one way, nobody would argue.
- **Blocked**: the answer depends on a decision still open. Name it.
- **Two decisions**: the brief holds more than one. Name each.

## 3. Write the card

`mode: card` → `<page-dir>/questions/<id>.html`, one `<aisf-question name="<id>">`. Read
`aisf:artifacts` and its `references/elements.md` and `references/figures.md` first.
`mode: chat` → `<page-dir>/questions/<id>.md`, the question in `aisf:grilling`'s round format,
same content.

One question per card. Each card is **self-contained**: someone who never saw the ticket
answers it without scrolling elsewhere. Every term is defined on the card or common knowledge.

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
  <aisf-more>code excerpt by path, edge cases, research findings, term definitions</aisf-more>
</aisf-question>
```

- `problem` holds the problem, `gain`, `cost` and `effect` each option's consequence,
  `<aisf-more>` the depth. The kit adds Other and Discuss.
- **A figure is the default.** It shows each option, not only today's state: comparing the
  options is what the human decides on. Only a pure naming or wording choice goes without, and
  the card says why.
- **About 50 words of prose** outside the figure, the effect lines and **More**. Depth goes
  into **More**.
- **Every option carries its consequence**: one gain, one cost, and its effect. The effect is
  fact only: what gets built or changed (module, layer, table), and how many sub-issues it adds
  or removes. A scope-extending option shows the added work there.
- **A necessary extension** opens its heading with `Extends scope:` and names the criterion
  that needs it in `problem` ("AC2 fails without it").

**Pick the figure by what is decided:**

| Decision about           | Figure                                                       |
| ------------------------ | ------------------------------------------------------------ |
| UI / UX                  | low-fi mockup, one per option (`aisf-context kind="mockup"`) |
| Flow, order of calls     | `aisf-sequence`                                              |
| State, lifecycle         | `aisf-state`                                                 |
| Where code lives         | `aisf-modmap`, new and changed units marked                  |
| Data shape, API, storage | `.aisf-diff`, before → after, by path                        |
| Library                  | `table.aisf-table`: fit, size, upkeep, precedent             |
| Options side by side     | `.aisf-compare` with one `.aisf-panel` per option            |
| Anything else            | free SVG with `aisf-shape*`, `aisf-label`, `aisf-edge`       |
| Necessary extension      | the criterion's path, with the forced extra work marked      |
| `hitl` checkpoint        | the full checkpoint: what is set up, what the human does     |

## 4. Report

Return only this. The card holds the depth.

```
result: card <path> | precedent <decision · source> | blocked <open decision> | split <decisions>
heading: <the question>
suggestion: <option> · <why>
assumes: <…>
findings:
<question · finding · source>, one line each, new ones only
```
