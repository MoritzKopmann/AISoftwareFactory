---
name: ui-ticket
description: >
  Split a plain-HTML design document into a parent ticket plus one ready sub-issue per
  component, each with its own mock and landing zone.
  Use when the user wants to turn a design into UI tickets. Triggers: "ui-ticket",
  "split this design into tickets", "ticket this mockup".
disable-model-invocation: true
---

# ui-ticket

Turn one design document into a parent design ticket plus one `status: ready` sub-issue per
component, each precise enough to build from and carrying its own mock page. Built by
`aisf:ui-implement-ticket`.

**The design is the spec.** `aisf:create-ticket` settles _what_ and `aisf:plan-ticket` settles
_how_. The mockup has already settled both for everything visual, so this skill does not
interview. The one thing it asks the human is what to do about UI the app can't back yet
(step 5): it flags each such piece and never guesses.

Apart from that decision it runs one-shot, so the checks in step 6 are what stand between a
bad split and many bad tickets.

`gh` infers the repository from the current checkout. Never pass `-R`. Every issue write goes
through `aisf:github-issue`: native `--parent` and `--blocked-by`, never `Depends on` or
`Part of` text.

## Inputs

    /aisf:ui-ticket <design.html> [parent-issue#]

- **Design doc**: a plain-HTML file or URL. Nothing is unpacked: read the HTML source itself.
- **Parent issue**: optional. Given one, extend it into the design parent and inherit its
  `priority:`. Omitted, create a fresh parent.

Load `project-architecture`, `project-testing` and `project-toolchain` with the Skill tool
before step 2. Every landing-zone and wiring decision answers to them. If any returns
`Unknown skill`, stop and report "project not onboarded".

## 1. Read the design

Read the HTML source. It carries the exact hex, px, order and nesting. An invented number is
indistinguishable from a measured one once it is in a ticket.

**Boards are usually variants, not separate screens.** Several boards showing one page in
several states is one set of components. Diff them early: what changes between them _is_ the
state list you owe each component.

Get the app's palette once, from `packages/app/assets/kit/kit.css` (light and dark). Designs
for this app tend to use the tokens already, so most hexes match one exactly.

## 2. Split into components

**One sub-issue is one independently buildable, independently PR-able component.**

Split where a piece has its own state, owns its own data, or appears in more than one place. A
chip inside a card is described _inside_ the card's ticket. The same chip in two cards earns
its own. Split along seams, not line counts.

A ticket per icon buries the work in review overhead. "Build the whole page" is unreviewable
and hides the decisions this skill exists to surface. The test: _could someone open a PR for
this alone, and could you tell from the result whether it is right?_

Order containers before their contents: a component that needs its parent is created blocked
by it. A component that needs a _half-done sibling_ means the split is wrong: merge the two.

## 3. Research the landing zone

Read-only. Never edit files, commit or open PRs here. For each component, answer before
describing it:

- **Where it lands**: the exact path, per `project-architecture`.
- **Add or replace**: name the component it replaces and what gets deleted. A replacement
  ticket that only says what to add leaves the old one alive beside the new one.
- **What already exists**: the view model, API route or state it plugs into, and whether the
  data it renders is exposed at all. Anything missing is flagged in step 5, not assumed.

Prefer reduction to addition: a component an existing one covers with one parameter is a
modification, not a new file.

## 4. Describe each component, and build its mock

The implementer sees this description, its mock and nothing else. Every number you leave out is
a number they invent. Work the checklist, skipping only what does not apply:

- **Anatomy**: every child element, in render order.
- **Layout**: row / column / stack, alignment, wrap and overflow.
- **Dimensions**: width, height, min/max, aspect ratio.
- **Spacing**: padding, gaps, margins, in px.
- **Colour**: per surface, text, icon and border, in the form below.
- **Typography**: size, weight, line-height, letter-spacing.
- **Shape**: corner radius, borders, shadow.
- **Iconography**: which icon, size, colour.
- **States**: default, hover, focus, disabled, selected, loading, empty, error. The board diff
  gives you most. A state no board shows still needs an answer.
- **Behaviour**: what click, keyboard and scroll do.
- **Responsive**: long text, narrow viewport, many items, none.

**Every colour is written as its hex _and_ its `kit.css` token**, so the implementer never
guesses which to use:

    #f8fafb → var(--surface) (exact)
    #fbfaf8 → no token matches; closest is var(--surface) #f8fafb (visibly warmer)

A colour with no token is a **decision**: say whether to add a token to `kit.css` or hardcode
it. Adding a token is design work and stays inside the component ticket.

**The mock**: one published page per component, showing only that component. It has the render
(the component alone, at real width, **light and dark side by side**) and the spec checklist
as a table below it. Lift the markup from the design verbatim instead of rebuilding it, and for
the dark column swap in the `kit.css` dark values. Publish it with the `Artifact` tool, titled
after the component, and put its URL in the ticket.

## 5. Flag UI that needs new features

Anything the design shows that the app can't back today: data nothing exposes, an interaction
with no receiver, new persistence, a navigation target that doesn't exist, a whole feature.
List every such piece with the component it belongs to and what is missing.

**Ask the human, one flagged piece at a time, with a recommendation.** Three choices:

- **Scrap**: drop that part of the UI. It leaves the component ticket, the mock and the
  acceptance criteria, and the parent's out-of-scope list names it.
- **Update**: change the UI so it needs nothing new (a static label instead of a live count, no
  control instead of a dead one). Say what replaces it and update the component's description
  and mock to match.
- **Blocking ticket**: file the feature first. It is its own ticket: `status: backlog`,
  `type: enhancement`, **standalone, not a sub-issue of the design parent**, holding what the
  UI needs from it. The component is created blocked by it (`--blocked-by`), so it isn't picked
  up early. Post these tickets **before** the components, so their numbers exist.

Several pieces needing one feature share one blocking ticket. Take no action for a piece until
the human has chosen. Record every choice in the parent's body.

## 6. Write to GitHub

Through `aisf:github-issue`, in this order, each step needs the numbers from the last: **parent
→ blocking tickets → components in dependency order.**

- **Parent**: the design doc, a screen-by-screen overview, the component list with numbers,
  what is out of scope. Labels: `type: enhancement`, `priority:` (inherited, else `medium`),
  `status: planned` once it has children (a parent is never implemented). Given an existing
  parent, extend its body instead of replacing it.
- **Each component**: created with `--parent`, `--blocked-by` and `status: ready`. Title is
  the outcome, not the class name. Body: **Context** (one sentence), **Design** (mock URL and
  design doc), **Landing zone**, **Description** (the step 4 checklist and its prose),
  **Wiring** (per `project-architecture`), **Scope** with an **Out** list, **Acceptance
  criteria** (observable outcomes, including every state).

**Four checks before posting anything.** A failure is a defect in the split, not a note on a
ticket: go back and fix it.

- **Full coverage.** Walk every board. Every visible element belongs to exactly one
  sub-issue. In none is dropped work. In two is a merge conflict waiting.
- **Buildable alone.** Read each sub-issue as someone with no memory of the design.
- **No invented numbers.** Every px, hex and weight traces to the source.
- **Gaps are flagged.** A component that quietly assumes an endpoint exists fails at
  implementation time, with the cost already sunk.

After posting, confirm the parent's count matches:
`gh issue view <p> --json subIssuesSummary --jq .subIssuesSummary.total`. Report every number
posted.

## Left to Epic: Design path (#34)

This is the bare-bones version. It does not handle:

- `aisf:design` and the local design canvas: the design doc is plain HTML you supply.
- The `## Design tokens` and `## Visual rendering` project slots: the tokens come straight from
  `kit.css`.
- Gating on `type: ui` and `## UI: yes`.
- The Design this and Attach design entry points.
