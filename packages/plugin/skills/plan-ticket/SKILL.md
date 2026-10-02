---
name: plan-ticket
description: >
  Turn a settled GitHub ticket (status: plan) into a technical plan on the ticket and one spec
  per sub-issue, each buildable on its own by aisf:implement-ticket. UI work is split off as one
  type: ui sub-issue for the design path. Interviews the human, always with a recommendation,
  until nothing is left open. Use when the user wants to plan a ticket or epic. Triggers:
  "plan #N", "plan ticket N", "plan this epic".
---

# plan-ticket

Turn a ticket at `status: plan` into a plan on the ticket and a spec on each sub-issue.
Argument: ticket number. If none, ask.

`gh` infers the repository from the current checkout. Never pass `-R`. Every status change and
every issue write goes through `aisf:github-issue`.

**The agent plans, the human decides.** Nothing is silently assumed.

`aisf:create-ticket` settled _what_, this settles _how_, `aisf:implement-ticket` writes the
code: one sub-issue, one branch, one PR. A parent with children is a tracking umbrella.

## Precondition

**Project slots.** Load `project-toolchain`, `project-architecture` and `project-testing` with
the Skill tool (bare names), then every skill they name under `## Load also`. Any
`Unknown skill` → stop and report "project not onboarded". Every project fact used below comes
from these slots, never from memory of another project.

**Status.**

```bash
gh issue view <n> --json title,body,labels,state,subIssues
```

`status: plan` → go on. Anything else → stop and name the stage the ticket needs.

**Spec check.** The body must state a clear desired outcome and acceptance criteria. Missing,
vague or self-contradictory → stop: comment the concrete gaps and guard `plan → idea`. Don't
invent what the spec left out.

**Resume.** A `## Planning so far` section means planning paused for a spike. Its spike still
open → stop and name it. Otherwise that section and the verdict under it are settled: they seed
the ledger and go to the planning agent, and step 3 asks only what is still open.

## 1. Research

State the desired end state in a few sentences. It decides what to research.

Read-only `Explore` agents in parallel, as many as the ticket needs, **each with one specific
question**: where this lands, how the project already does it, which contract it crosses. Every
prompt says: _"Do not edit files, commit, or open PRs — report findings only."_

**A dependency the project lacks** is checked against `project-toolchain`'s dependency bar and
becomes a question in step 3. A new dependency is never the agent's call.

## 2. Plan

One read-only planning subagent; say so in the prompt. It gets the ticket body, the research
findings and the three project slots, and may read the codebase.

**Seat: senior developer in `project-architecture`'s `## Stack`.** It:

- **Enforces `## Hard bans` and `## Placement rules`**, and names every change in
  `## Plan vocabulary` terms.
- **Optimizes for homogeneity.** A second way to do what the project already does is a defect.
  It argues from precedent, citing code by name.
- **Prefers reduction to addition.** It hunts the existing type, port or use case that makes new
  code unnecessary, and says what to delete.
- **Names failure modes and their blast radius**, and marks where the cheap path is fine.

**Returns** the plan, as answers in three areas:

- **Architecture and data flow.** Where each piece lands: module, layer, class type, new or
  existing. What is reused, changed and deleted. Data model and migrations. One flow line per
  use case: entry point → what it calls → what that calls next. For each surface under
  `project-architecture`'s `## UI`: what is shown, in which states, which actions the user has,
  and the API contract that feeds it. No layout.
- **Tools and libraries.** A new dependency or piece of infrastructure, and why nothing the
  project has covers it. Omit when none.
- **Practices and tests.** Only what is specific to this ticket: what can't be unit tested, what
  needs a human check, how sensitive data is handled. Omit when empty.

Plus:

- **Spike call.** Does a decision need real experience first? If yes: the options, what result
  settles them, and whether the human has to judge that result.
- **Questions.** Each a **Question** in plain language, a **Suggestion** (its answer plus one
  line of why, never "it depends") and **Assumes** (what the suggestion rests on). Decisions
  only: something cheap to change that nobody would have an opinion about is not a question.

## 3. Interview

Load `aisf:grilling` and follow it. Specific to planning:

- **The root question is the slice**: the thinnest end-to-end thing that satisfies the ticket,
  and what it gives up.
- **Every recommendation comes from the planning agent**: its suggestion, or what its plan
  implies.
- **Rounds go on the questionnaire page.** With the `Artifact` tool present, read
  `questionnaire.md` (this folder) and ask every round there. Without it, ask in chat.
- **Object immediately** to an answer breaking a hard ban or placement rule: one sentence, naming
  the rule and the legal alternative. If the human reaffirms, comply and record it under Risks
  as a knowing override.
- **An answer contradicting a settled decision's `assumes:` reopens that decision.** Re-scan
  once per round.
- **Ledger.** One scratchpad file, appended each round:
  `decision · resolution · assumes: … · round N`. Later steps read the ledger, not the
  scrollback.

**Spike.** A decision that needs real experience first pauses planning:

1. Post a sub-issue, `type: spike`, `status: ready`: the options, what result settles them, and
   that its verdict goes into this ticket's `## Planning so far`. It gets `hitl` when the human
   confirmed they judge the result; without it `aisf:spike` tests alone.
2. Write the ledger into the ticket body as `## Planning so far`, ending with
   `Waiting for the verdict of #<spike>`.
3. The ticket stays `status: plan`. Report the spike's number, that `aisf:spike` runs it, and
   stop.

## 4. Split

**Frontend and backend first.** Frontend is everything in the surfaces `project-architecture`
lists under `## UI`. All of it becomes **one UI sub-issue**, built later through the design
path, never by `aisf:implement-ticket`. It is blocked by every backend sub-issue it reads from.

**Backend** splits into small, ordered sub-issues along the seams `project-architecture` draws
(module boundaries, then layer boundaries), not line counts. Infrastructure before consumers. A
sub-issue may depend on an earlier one but must not need a sibling half-done.

Per sub-issue: **Title** (the outcome) · **Scope** (one sentence, in and out) · **Blocked-by** ·
**Proves** (which acceptance criteria) · **`hitl`** proposed or not, with its human checkpoint:
what the human does or judges. Nothing before it may need them. A criterion that needs the
running app or a real external write goes to a `hitl` sub-issue only.

Two splits have no umbrella:

- **Fits one PR, no UI.** Plan and spec land on the ticket itself.
- **UI only.** The ticket itself becomes the UI ticket.

## 5. Confirm

Show the split as a table: **Title** · **Blocked-by** · **Proposed `hitl`** and its checkpoint.
On the questionnaire page it is the last section, otherwise in chat.

**This is the only gate.** Confirmed → the rest runs without further approval. Not confirmed →
reopen that decision and go back to step 3.

## 6. Write the plan

Assemble it from the ledger plus the planner's material that never became a question.
Synthesize; don't write a fresh second plan.

    ## Technical plan

    ### Architecture and data flow
    ### Tools and libraries
    ### Practices and tests
    ### Risks
    Failure modes and blast radius · knowing human overrides.
    ### Out of scope
    ### Acceptance criteria
    The ticket's own criteria, each tagged with the sub-issue that proves it.
    ### Sub-issues
    The step 4 list, in order.

- **Name what crosses a sub-issue boundary**: routes, schemas, bus events, tables. Names and
  data shapes, never code bodies.
- **Pin down what is expensive to correct or that the human decided. Leave free what is cheap.**
- **A broken flow is a defect, not a footnote.** A step ending nowhere, a piece nothing calls:
  fix it here.

## 7. Write the specs

**Backend.** One subagent per backend sub-issue, in parallel, read-only. Each gets the plan and
its row of the split, and follows `spec-template.md` (this folder). A decision the plan leaves
open comes back as a question, never as a guess: put it to the human, record the answer in
ledger and plan, then let that spec finish.

**UI.** Write the UI sub-issue yourself, from the plan: what is shown, in which states (empty,
loading, error, too much data), which actions the user has, and the API contract that feeds it.
No layout, no files, no Given/When/Then: the design settles those.

**Three checks before posting.** A failure is a defect in the split, not a note on the ticket:
resplit or add a sub-issue, and take a changed split back to step 5.

- **Seams match.** Walk the flow. Every step whose ends land in different sub-issues is a shared
  contract: both specs must give it the same name and shape. A step no sub-issue implements is
  dropped work.
- **File coverage.** Every file the plan names is claimed by at least one spec. Unclaimed means
  dropped: a migration, a wiring entry from `project-architecture`'s `## Easy-to-miss wiring`.
- **No criterion left unproven.** Every acceptance criterion maps to a sub-issue whose criteria
  prove its share.

## 8. Write to GitHub

Everything through `aisf:github-issue`.

1. **The ticket.** Append `## Technical plan` to its body, replacing `## Planning so far` if
   present.
2. **Sub-issues, in dependency order**, each with `--parent`, `--blocked-by` and the ticket's
   `priority:`. Backend: the spec as body, its own `type:`, `status: ready`, `hitl` where
   confirmed. UI: `type: ui`, `status: backlog`.
3. **Backfill** the plan with the real sub-issue numbers, guard `plan → planned`, and check
   the count landed:

   ```bash
   gh issue view <n> --json subIssuesSummary --jq .subIssuesSummary.total
   ```

**Fits one PR:** `## Technical plan`, then the spec under `## Spec`, go on the ticket itself.
Then guard `plan → ready`.

**UI only:** the UI description goes on the ticket itself, its `type:` becomes `type: ui`, then
guard `plan → backlog`.

Report every number written, what `aisf:implement-ticket` can pick up next, and for a UI ticket
that it needs a design before `aisf:ui-ticket <design> <n>`.
