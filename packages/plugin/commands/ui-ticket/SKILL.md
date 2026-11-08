---
name: ui-ticket
description: >
  Split the accepted design of a `type: ui` ticket (status: plan) into one ready leaf per
  component, each with a local mock. Asks the human only about pieces the app can't back.
  Use when a designed UI ticket is ready to split. Triggers: "ui-ticket", "split the design
  into tickets", "ticket this design".
---

# ui-ticket

Turn the accepted design of ticket `<n>` into one `status: ready` leaf per component. Each
leaf carries its own mock, a local file. Built by `aisf:ui-implement-ticket`.

**The design is the spec.** `aisf:create-ticket` settled _what_, `aisf:design` settled the
look. This skill does not interview. It asks the human one thing: what to do with a piece the
app can't back (step 5). It flags each such piece and never guesses.

It runs one-shot, so the checks in step 6 stand between a bad split and many bad tickets.

`gh` infers the repository from the current checkout. Never pass `-R`. Every issue write goes
through `aisf:github-issue`: native `--parent` and `--blocked-by`, never `Depends on` or
`Part of` text.

Nothing is published outside the machine. No `Artifact` tool, no upload. Every mock is a local
file. The `ui-split` page of step 5 is the one page shown, through `aisf_show_artifact`.

## Input

    /aisf:ui-ticket <n>

`<n>` is the ticket. If none, ask. The design folder is `.aisf/artifacts/design/` in the
current worktree (the ticket's `-authoring` worktree).

## 0. Precondition

Check in this order. Each failure → `aisf_escalate` `spec`, naming what is missing. Write
nothing. (Hand-run: say what is missing and stop.)

1. `gh issue view <n> --json title,body,labels,state`: open, `status: plan`, `type: ui`.
   Without `type: ui` → stop, name `aisf:plan-ticket`, write nothing.
2. `project-design` loads (Skill tool). `Unknown skill` → escalate, name the slot.
3. `project-testing` has a `## Visual rendering` heading. Missing → escalate, name it.
4. `.aisf/artifacts/design/index.json` exists. Missing → escalate, name
   `.aisf/artifacts/design/`.

Then load `project-architecture` and `project-toolchain`. Landing-zone decisions answer to
them.

## 1. Read the design

Read `index.json` (the `note` of each board is the designer's voice), `tokens.css`, and every
`boards/<id>.html`. The HTML source carries the exact px, order and nesting. An invented
number is indistinguishable from a measured one once it is in a ticket.

Boards are usually variants of one screen. Diff them: what changes between them _is_ the
state list each component owes.

Elements with `data-annotation` are the designer's notes. Never build them.

## 2. Split into components

**One leaf is one independently PR-able component: an element with `data-part`.**

A part inside another part is described inside its container, unless it appears in more than
one place, then it earns its own. Split along seams, not line counts. The test: _could
someone open a PR for this alone, and could you tell from the result whether it is right?_

Order containers before their contents. A component that needs a half-done sibling means the
split is wrong: merge the two.

## 3. Research the landing zone

Read-only on code. For each component answer:

- **Where it lands**: the exact path, per `project-architecture` and `project-design`.
- **Add or replace**: name what it replaces and what gets deleted.
- **What exists**: the view model, route or state it plugs into, and whether its data is
  exposed at all. Anything missing goes to step 5.

Prefer reduction: a component an existing one covers with one parameter is a modification.

## 4. Describe each component, and write its mock

The implementer sees this description, the mock and nothing else. Work the checklist, skip
only what does not apply: anatomy, layout, dimensions, spacing, colour, typography, shape,
iconography, states (default, hover, focus, disabled, selected, loading, empty, error),
behaviour, responsive.

**Colour is written as the board's `var(--…)` role token.** A `/* NEW */` token in
`tokens.css` is a decision: write it into that leaf, with the board note's reason.

**The mock** is `.aisf/artifacts/design/mocks/<part>.html`, one per leaf. `<part>` is the
component's `data-part` name.

- Links `../tokens.css`. Colours only `var(--…)`. No script, no remote URL.
- Shows the component alone, at real width, every state, light and dark (set `data-theme`
  on each copy).
- Below the render: the spec as a table.
- Markup lifted from the board verbatim, not rebuilt.

## 5. Flag UI the app can't back

Anything the design shows that the app can't back today: data nothing exposes, an interaction
with no receiver, new persistence, a missing navigation target, a whole feature.

Ask on one page, id `ui-split` (`aisf:artifacts`, `aisf_show_artifact`). **One question per
piece**, each with a recommendation. Three answers:

- **Scrap**: leave the piece out. Remove it from the leaf and its mock. List it as out of
  scope on `<n>`.
- **Update**: change the piece so it needs nothing new (a static label for a live count).
  Update the leaf description and the mock.
- **Blocking ticket**: standalone, `status: backlog`, `type: enhancement`, not a sub-issue of
  `<n>`, holding what the UI needs. Posted before the leaves. Each leaf that needs it is
  `--blocked-by` it.

Pieces needing one feature share one blocking ticket. Take no action for a piece before its
answer. No gaps → no page. Hand-run without a page tool: ask in chat.

## 6. Write to GitHub

**Four checks before posting anything.** A failure is a defect in the split: fix it. If it
can't be fixed → `aisf_escalate` `spec`.

- **Full coverage.** Every visible, non-annotation element belongs to exactly one leaf.
- **Buildable alone.** Read each leaf as someone with no memory of the design.
- **No invented numbers.** Every px and token traces to the board or `tokens.css`.
- **Gaps flagged.** No leaf quietly assumes a route or data that doesn't exist.

Post through `aisf:github-issue`, in this order:

1. **Blocking tickets**, from step 5.
2. **Leaves in dependency order**, each with `--parent <n>`, labels `type: ui`,
   `priority:` copied from `<n>`, `status: ready`. No `hitl`. `--blocked-by` its blocking
   tickets and containers. Title is the outcome, not the class name. Body: **Context** (one
   sentence), **Part** (`<part>` and the mock path `.aisf/design/mocks/<part>.html`),
   **Landing zone**, **Description** (the step 4 checklist), **Scope** with an **Out** list,
   **Acceptance criteria** (observable outcomes, every state).
3. Guard `plan → planned` on `<n>`. Add the Scrap list as out of scope on `<n>`.
4. Check the count:
   `gh issue view <n> --json subIssuesSummary --jq .subIssuesSummary.total`.

There is no separate verification leaf: each leaf's PR is the human check.

Report every number posted.
