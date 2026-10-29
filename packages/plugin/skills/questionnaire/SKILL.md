---
name: questionnaire
description: >
  The shared way to ask the human in rounds on one bridge page: a design tree worked frontier by
  frontier, one card per question, no recommendation, the ledger as memory. Names the three agents
  that build the cards, the round and the header. Loaded by aisf:plan-ticket for its interview. Use when a skill must interview the human on a page.
---

# questionnaire

The pattern for asking in rounds. The calling skill owns its questions, its stance and its
page id. This skill owns how the asking works.

## The tree

Map the decisions as a **design tree**: every decision branches into the decisions that hang off
it. Work it in **rounds**.

- The **frontier** is every decision whose prerequisites are settled. Ask the whole frontier in
  one round.
- A question that depends on one still open waits for a later round.
- Each answer reshapes the tree. Recompute the frontier, then ask the next round.
- Finding facts is your job, never the human's. Look them up, or send an agent. The decisions
  are the human's.
- **No card recommends an answer.**

## One page per session

All rounds live on **one bridge page**, id `<page-id>`, in `.aisf/artifacts/<page-id>/`. Build
the page with the agents below. The calling skill shows it itself with `aisf_show_artifact`
(read `aisf:artifacts` first), never from an agent. Chat gets no questions.

## The ledger is the memory

`.aisf/artifacts/<page-id>/ledger.md` holds every settled decision and answer, appended each
round. `findings.md` in the same folder holds researched facts. A resumed session reads both
and asks only what is still open.

## The agents

| Agent              | Role                                                                                      | Called                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `question-builder` | Builds the card for one question. Returns a card, a settled row or a split.               | Once per question, in parallel                                              |
| `round-builder`    | Assembles one round into the page with `build-page.mjs`.                                  | Once per round, after the cards                                             |
| `playback-builder` | Writes the page header: the end state and the playback map, kept in step with the ledger. | Once per round, before `round-builder`, only for a caller that has a header |

Each agent's input and rules are in its own file (`agents/`). The input contract of a round is in `round-builder`. The `build-page.mjs` path to pass to
`round-builder` is the absolute path of `build-page.mjs` in this folder.

## Reading the answer

Read it as `aisf:artifacts` says (_Reading the answer_). A free-text answer (`choice` is
`text`) that cannot be read clearly becomes a follow-up question in the next round. Earlier
rounds freeze into read-only summaries: decision · answer. `assumes` lives in the ledger only,
never on a card.

The page is a decision device: disposable, and never linked from GitHub.
