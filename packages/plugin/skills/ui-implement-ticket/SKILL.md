---
name: ui-implement-ticket
description: >
  Drive a UI component leaf from aisf:ui-ticket to a PR: build the component against its
  mock through a render, look, adjust loop using headless-Chrome screenshots in both themes,
  test behaviour with TDD, verify acceptance criteria, commit, open the PR. Use when the
  ticket's work is visual and carries a design mock. Triggers: "implement the ui ticket #N",
  "build component #N".
disable-model-invocation: true
---

# ui-implement-ticket

Drive a component ticket to a PR. Argument: ticket number. If none, ask.

**Why this is separate from `aisf:implement-ticket`:** TDD has no grip on geometry. A ticket
whose criteria are `16px padding`, `12px radius`, `var(--surface)` yields assertions like
`expect(padding).toBe('16px')`: the implementation restated in a test, which can only fail when
someone deliberately changes the value and updates the test. It looks like verification and is
really transcription.

The oracle for visual work is the mock, so the loop here is **render, look, adjust**. TDD keeps
the job it is good at: behaviour and the `describe-*` view models.

**This skill follows `aisf:implement-ticket` for everything not visual.** Read it and apply
these sections as written there: §0 Precondition (project slots, status table, mode), Stop
points, §1 Identify (blocked, rework), §3 Branch, §5 Green (five fix attempts, never weaken a
test), §8 Simplicity review, §9 Commit, §10 PR (body, base check, `in-progress → in-review`),
and never merge. The sections below replace §2, §4 and §7, and add the render loop.

`gh` infers the repository from the current checkout. Never pass `-R`. Every status change and
issue write goes through `aisf:github-issue`.

## 1. Pick the ticket

The number you were given may be a parent (`status: planned`). Parents are never implemented:
list its open children that are `status: ready` and unblocked, report them and stop, as
`aisf:implement-ticket` §1 does.

Then two checks:

- **The verification leaf?** Every design ends with a `hitl` "Verify the implemented … against
  the design document" leaf asking the _human_ for screenshots of the running app. That is not
  this skill's work: say so and stop, or you produce a PR containing nothing. Run it by hand
  with the human in chat and record their verdicts as a comment on the leaf.
- **Blocked?** An open `blockedBy` issue → stop and name it.

Name `<n>` and the mode before touching a file.

## 2. Understand

- Read the ticket: `gh issue view <n> --json title,body,labels,state,parent,blockedBy`.
- **Open the mock** (`Artifact` action `read` on the URL in the ticket). It holds the render
  _and_ the spec table, and it is what you build against. A component ticket without one is
  missing its spec: escalate `spec` rather than inventing it.
- Load `aisf:tdd`, `project-architecture`, `project-testing` and `project-toolchain`, plus each
  skill they name under `## Load also`.
- List the exact files, the states, the behaviours and which test proves each. No code first.

If it replaces a component, deleting that is part of the job, not a follow-up.

## 3. Render loop

Start the Vite app (the `packages/ui` dev server, per `project-toolchain`) and keep it running.
Take a headless-Chrome screenshot of the page showing the component in **both themes**, every
time:

    google-chrome --headless --hide-scrollbars --window-size=<width>,<height> \
      --virtual-time-budget=5000 --screenshot=<tmp>/<component>-light.png <url>

    google-chrome --headless --hide-scrollbars --window-size=<width>,<height> \
      --virtual-time-budget=5000 --screenshot=<tmp>/<component>-dark.png <url-with-dark>

`kit.css` themes through `prefers-color-scheme` and a `data-theme` attribute. Headless Chrome has
no flag for the colour scheme, so get dark by loading a page that sets `data-theme="dark"` on
`<html>`: a query parameter the render page reads, or a small wrapper page under `<tmp>`. Give
the loop a render page that shows every state of the component side by side, so one shot covers
them all.

Screenshots go under `<tmp>`. Nothing visual is versioned, and no new dependency is added.

**Render, look at the PNG (Read it), compare against the mock, adjust, render again.**

Actually look at it, beside the mock's render. Then walk the ticket's checklist (anatomy,
layout, dimensions, spacing, colour, typography, shape, iconography, states) and decide per
line: matches or doesn't. A line you did not check is a line you did not build.

Use the token, not the literal. The ticket gives every colour as hex _and_ `kit.css` token: the
token goes in the code so the component follows the theme instead of freezing one palette. A
colour with no token: follow what the ticket decided instead of approximating.

**Stop when every checklist item matches or has a stated reason it can't.** Pixel-perfect is not
the goal. An unresolvable difference is not a failure: carry it to the PR as a known deviation.
Swallowing it silently is the only wrong move, and quitting at the first render because it looks
roughly right is the same mistake in the other direction.

## 4. Behaviour, with TDD

Per `aisf:tdd`, one behaviour per Red-Green-Refactor cycle: what a click or key does, which
state the view model describes for each input (the `describe-*` functions), callbacks and
navigation.

**Never assert geometry**: no padding, radius or colour equality, no counting wrapper elements.
Those restate the code, break on every legitimate tweak and teach the next person to update tests
without thinking. Geometry is what the render is for.

Placement and wiring follow `project-architecture`, test layout follows `project-testing`.

**Stay inside Scope.** What the ticket lists under **Out** belongs to a sibling. Editing their
files creates a conflict in their PR.

## 5. Verify acceptance criteria

Every criterion gets evidence, by kind:

- **Behavioural**: the passing test that asserts it, named.
- **A command**: run it verbatim and show the output.
- **Visual**: the render plus your verdict on that criterion. "Matches the mock" is not
  evidence. "16px padding, radius 12, `var(--surface)`: matches; dark `--accent` reads heavier
  than the mock, noted as a deviation" is.

Vague or unprovable as written → escalate `spec`, never quietly rate it green.

## 6. Publish the render

Publish the final light and dark PNGs as an `Artifact` and keep the URL. Nothing visual is
committed, so this is the only durable record of what was built: it puts mock and result side by
side in the PR without anyone checking out the branch. Stop the dev server.

## 7. The PR

The PR body follows `aisf:implement-ticket` §10, with two additions: a `## Design` section
(`Mock: <ticket's mock URL>`, `Built: <render URL from step 6>`) after `## Summary`, and
`## Known deviations` (every unresolved difference from the mock, and why; omit if none)
before `Closes #<n>`. Report as §10 does, plus the render URL.

**What you are giving up.** There is no visual regression net, which makes the design's final
`hitl` verification leaf the only thing between a visual regression and a release.

## Left to Epic: Design path (#34)

This is the bare-bones version. It does not handle:

- `aisf:design` and the local design canvas.
- The `## Design tokens` and `## Visual rendering` project slots: the loop is fixed to
  `kit.css` and headless Chrome.
- Gating on `type: ui` and `## UI: yes`.
- The Design this and Attach design entry points.
