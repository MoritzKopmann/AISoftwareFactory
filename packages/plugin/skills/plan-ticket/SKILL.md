---
name: plan-ticket
description: >
  Turn a settled GitHub ticket (status: plan) into a technical plan on the ticket and one spec
  per sub-issue, each buildable on its own by aisf:implement-ticket. UI work is split off as one
  type: ui sub-issue for the design path. A ticket holding several independent features can be
  split into smaller tickets at the round-1 playback. Interviews the human, always with a recommendation,
  until nothing is left open. Use when the user wants to plan a ticket or epic. Triggers:
  "plan #N", "plan ticket N", "plan this epic".
---

# plan-ticket

Turn a ticket at `status: plan` into a plan on the ticket and a spec on each sub-issue.
Argument: ticket number. If none, ask.

`gh` infers the repository from the current checkout. Never pass `-R`. Every status change and
every issue write goes through `aisf:github-issue`.

**The agent plans, the human decides.** Nothing is silently assumed.

- **Never guess.** Underdefined → ask.
- **Never make a feature decision alone**, unless it follows directly from one already made.

`aisf:create-ticket` settled _what_, this settles _how_, `aisf:implement-ticket` writes the
code: one sub-issue, one branch, one PR. A parent with children is a tracking umbrella. A ticket
that holds several independent features may instead be split into smaller tickets (step 3).

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

**Resume after a split.** `<n>` at `status: plan` with open non-spike children at
`status: plan` means a split was accepted and posting stopped part-way. Post only the missing
parts (_Too big: split the ticket_, Posting), guard `plan → planned`, report, stop.

**Resume.** A `## Planning so far` section means planning paused for a spike. Its spike still
open → stop and name it. Otherwise that section and the verdict under it are settled: they seed
the ledger, and step 3 asks only what is still open. A resumed session reads the ledger and the
findings log from `.aisf/artifacts/plan-<n>/` (`ledger.md`, `findings.md`).

## Your seat

You plan. **Seat: senior developer in the project's stack.** You:

- **Enforce `project-architecture`'s rules** (SKILL.md and `references/rules.md`), and name every
  change in its terms.
- **Optimize for homogeneity.** A second way to do what the project already does is a defect.
  Argue from precedent, citing code by name.
- **Prefer reduction to addition** within the criteria. Hunt the existing type, port or use
  case that makes the code a criterion needs unnecessary.
- **Name the failure modes of what the criteria need**, with their blast radius, and mark where
  the cheap path is fine.

## Scope

**Scope is the acceptance criteria, nothing else.** One test decides every candidate: _would an
acceptance criterion fail without this?_

- **Yes** → in scope. Work a criterion forces beyond its literal text (a migration, a change to
  shared code) is a necessary extension: its question carries an **Extends scope** badge and
  the reason ("AC2 fails without it").
- **No** → not asked. It goes to Out of scope under **Noticed, not planned**, one line each.

Skip every module, layer and phase the criteria need no change in.

## 1. Research

State the desired end state in a few sentences. It decides what to research.

**Facts are the agents' job.** Dispatch read-only research agents whenever a fact is missing to
find the decisions, before or between rounds, as many as the ticket needs. Facts for one
question are its builder's job (_Build the questions_). Sources: the codebase, the web
(high-trust primary sources), and any project the human names. Each agent gets **one specific question**,
and every prompt says: _"Do not edit files, commit, or open PRs — report findings only."_

**Pattern research.** For each module with non-trivial business logic, one research agent asks
which design pattern, if any, fits that logic. "None" is a valid and likely answer. Its finding
goes to the findings log; it becomes a question only when a pattern is proposed.

**Findings log.** `.aisf/artifacts/plan-<n>/findings.md`: question · finding · source. Read it before every
dispatch; a question it already answers is never sent again.

**A dependency the project lacks** is checked against `project-toolchain`'s dependency bar and
becomes a question. A new dependency is never your call.

## 2. Decide

The decisions in scope, in **phases**. Presentation and infrastructure are wiring; business
holds the logic. Start from the UI, because criteria are usually written from the frontend's
view.

1. **UI.** Which UI area shows each criterion, what it shows in which states (empty, loading,
   error, too much data), the user's actions, and which data it needs from the backend. The
   frontend has no architecture rules: it shows the data the backend provides, and its internal
   layering is not planned.
2. **Modules.** Which backend module, existing or new, owns each feature.
3. **Inbound contract.** What each module offers the frontend, other modules and services:
   routes, facade methods, bus events, their data shapes, and the processes they trigger. It
   must cover every UI data need from phase 1.
4. **Business logic.** What exactly happens in the business layer, and the design pattern if
   pattern research proposed one.
5. **Outbound interfaces and data.** The ports to infrastructure, other modules and services.
   For a repository: what data is stored, and which tables are created, extended or changed.
   For anything else: what is sent, what comes back, and what it needs (an API key, an
   account).

Sort every decision in scope:

- **Question**: expensive to change, or open to real opinion. You name it in one line; its
  builder researches and writes it (_Build the questions_).
- **Settled by precedent**: the project already does it one way, and nobody would argue. One
  line: decision · source. The human sees it and may veto it.

**Spike call.** A decision that needs real experience first gets a spike: the options, what
result settles them, and whether the human has to judge that result.

### Build the questions

You pick the questions. Builders research and write them.

- **One builder per question**, all of a round dispatched at once. Each is a subagent whose
  prompt says _"Load `aisf:build-question` and follow it."_, plus the brief that skill names.
  Ids run on across the session (`q1`, `q2`, …).
- **Every question goes this way**: round questions, vetoes, reopened decisions, critic
  objections, `hitl` checkpoints, questions step 7 raises. Only the playback questions and
  the split question are yours (`questionnaire.md`).
- **On return**, append its `findings` lines to the findings log. Then by `result`:
  - `card` → check `suggestion` and `assumes` against the ledger and your seat. A conflict →
    dispatch again with the conflict named.
  - `precedent` → it moves to Settled by precedent.
  - `blocked` → it waits for the round after the decision it names.
  - `split` → brief each decision on its own.

## 3. Interview

Load `aisf:grilling` and follow it. Its design tree is the decisions in scope: "every branch"
means every branch the criteria need. Specific to planning:

- **Start with a playback.** Round 1 opens with the playback map (`questionnaire.md`): each
  acceptance criterion as a path through the touched UI and modules, by layer, new and changed
  parts marked. Under the map, one question per criterion: **Correct** (`suggested`) or **Wrong
  path**. Its other first questions are the ones that picture raises.
- **The map stays current.** It sits above every round. After each round, redraw it to match
  the decisions made, before republishing. A changed path is not asked again: the answer that
  changed it already decided it.
- **Phases shape the rounds.** Early rounds hold the early phases. A question from a later
  phase whose answer depends on nothing open may come early.
- **Group the frontier.** Every question whose answer does not depend on another open one goes
  in the same round. Research for the questions downstream runs meanwhile.
- **Rounds go on the bridge page.** With `aisf_show_artifact` present, read `questionnaire.md`
  (this folder) and ask every round there, from the builders' cards: one page per session, id
  `plan-<n>`, each round one `<aisf-round>`. A veto in a round's `vetoes` turns that decision into a question in the next
  round. Without the tool, interview and Confirm run in chat: builders get `mode: chat`, and
  you post their question files as the round.
- **Object immediately** to an answer breaking a hard ban or placement rule: one sentence, naming
  the rule and the legal alternative. If the human reaffirms, comply and record it under Risks
  as a knowing override.
- **Reopen what a later answer breaks.** An answer contradicting a settled decision's
  `assumes:`, or changing a layer an earlier phase settled, reopens that decision: it returns as
  a question in the next round, naming the answer that reopened it. Re-scan once per round.
- **Ledger.** `.aisf/artifacts/plan-<n>/ledger.md`, appended each round:
  `decision · resolution · assumes: … · round N`, precedent decisions included.
- **Files are the memory.** After each round, the ledger and the findings log hold everything
  later steps need. Later steps read them, not the scrollback, so a compacted context loses
  nothing.

**Done** when no decision in scope is open: every criterion has its flow, its landing module and
its data settled in the ledger.

**Spike.** A decision that needs real experience first pauses planning:

1. Post a sub-issue, `type: spike`, `status: ready`: the options, what result settles them, and
   that its verdict goes into this ticket's `## Planning so far`. It gets `hitl` when the human
   confirmed they judge the result; without it `aisf:spike` tests alone.
2. Write the ledger into the ticket body as `## Planning so far`, ending with
   `Waiting for the verdict of #<spike>`.
3. The ticket stays `status: plan`. Report the spike's number, that `aisf:spike` runs it, and
   stop.

## Too big: split the ticket

Not step 4 "Split". That one splits a plan into sub-issues. This one splits the ticket itself
into smaller tickets. It differs from `aisf:create-ticket`'s split: parts are full sub-issues
under an umbrella, not bare ideas.

**Rule.** Checked once, on a fresh round 1 (never on a spike resume). Split when the ticket asks
for two or more features, each enhancing the app and usable completely without the others. One
big feature is never split here. No token or count threshold. Rule does not fire → round 1 as
above, no split question.

**Round 1 when it fires:** the playback map and one split question, nothing else: no
per-criterion questions. One
`<aisf-question>`:

- An `<aisf-context kind="mockup">` shows each part: title, drafted Context and Scope written
  from `<n>`'s text, and its criteria numbered (A1, A2, B1 …).
- **Part criteria:** `<n>`'s criteria regrouped verbatim. A criterion touching several parts goes
  to each. New criteria only from the human's note.
- Cards: accept (`suggested`) and reject. The card tells the human to use Discuss for long edits.

**Answers.**

- **Other or Discuss** → the next round redraws the revised split. Nothing is posted. Only a
  clean accept posts.
- **Reject** → the next round asks today's round-1 questions. Steps 4–8 run as today.
- **Accept** → check each part body against the Spec check and `aisf:github-issue`'s cold-read
  test, then post.

**Posting.** Through `aisf:github-issue` mode **Split part**, one per part in dependency order:
`--parent <n>`, `type:` and `priority:` from `<n>`, `status: plan`, `--blocked-by` between parts
where one needs another. `<n>`'s body stays unchanged. Then the `subIssuesSummary.total` check,
then guard `plan → planned` on `<n>`.

**After posting:** report every part number and that each needs its own plan run. Stop. Steps
4–8 never run after a split.

## 4. Split

**Frontend and backend first.** Frontend is every surface a human sees, judged from the codebase. All of it becomes **one UI sub-issue**, built later through the design
path, never by `aisf:implement-ticket`. With `project-design` present, that child is filed as an
idea and starts its design run by itself. It is blocked by every backend sub-issue it reads from.

**Backend** is cut by module responsibility first, then along the interfaces between layers:
**one module and one layer each**, as `project-architecture` names them. Wiring a sub-issue's
classes into the composition root is part of that sub-issue.

- **Inside a module:** infrastructure → business → presentation.
- **Between modules:** by dependency. A provider's facade (presentation) comes before the
  consumer's adapter (infrastructure) that calls it.
- **Port exception:** an infrastructure sub-issue owns the port it implements in
  `business/port/`, and nothing else in business.
- **Small changes:** when a layer's share is wiring only, its module's layers may merge into one
  sub-issue. That is a question, with its effect.

Any other sub-issue touching a second module or layer is cut again. An exception is a question
to the human; an agreed one goes to Risks as a knowing override. A sub-issue may depend on an
earlier one but must not need a sibling half-done.

Per sub-issue: **Title** (the outcome) · **Module · Layer** · **Scope** (one sentence, in and
out) · **Blocked-by** ·
**Proves** (which acceptance criteria) · **`hitl`** proposed or not. Nothing before it may need
the human. A criterion that needs the running app or a real external write goes to a `hitl`
sub-issue only. A check a scenario can state is a scenario, never the checkpoint.

**Every `hitl` checkpoint is a question**, shown in full: what is set up, what the human does or
judges. Only an agreed checkpoint goes into a spec.

Two splits have no umbrella:

- **Fits one PR, no UI.** Plan and spec land on the ticket itself.
- **UI only.** The ticket itself becomes the UI ticket (an idea when `project-design` exists).

## 5. Critic

One read-only critic agent; say so in the prompt. It gets the ticket body, the ledger, the
draft split and the three project slots, and may read the codebase. It hunts: a breach of a hard
ban or placement rule, a second way to do what the project already does, an acceptance
criterion no sub-issue proves, a flow step ending nowhere, a decision taken without the human,
and work no criterion needs.

Each objection you share becomes a question in the next round (step 3). One you reject is listed
at Confirm with the reason, and goes to Risks.

## 6. Confirm

Show the split as a table: **Title** · **Module** · **Layer** · **Blocked-by** · **Proposed
`hitl`** and its checkpoint. On the bridge page it is the last round: an `<aisf-confirm>` with
one `<aisf-task>` per sub-issue, `heading="<Title> · <module> · <layer>"`, and its `hitl`
switch, plus the decision tree from the ledger as `<aisf-tree-node>`
rows. Without `aisf_show_artifact`, the table goes in chat. Confirm locks the `hitl` flags.

**This is the only gate** (besides an accepted split, which is its own gate). Confirmed → the rest runs without further approval. Not confirmed →
reopen that decision and go back to step 3.

## 7. Write the plan

One document, written by you from the ledger and the findings log. It holds the plan **and every
spec**.

    ## Technical plan

    ### Architecture and data flow
    Where each piece lands: module, layer, class type, new or existing. What is reused, changed
    and deleted. Data model and migrations. One flow line per use case: entry point → what it
    calls → what that calls next.
    ### Tools and libraries
    A new dependency or infrastructure, and why nothing the project has covers it. Omit when none.
    ### Practices and tests
    Only what is specific to this ticket: what can't be unit tested, what needs a human check,
    how sensitive data is handled. Omit when empty.
    ### Risks
    Failure modes and blast radius · knowing human overrides · rejected critic objections.
    ### Out of scope
    Including **Noticed, not planned**.
    ### Acceptance criteria
    The ticket's own criteria, each tagged with the sub-issue that proves it.
    ### Sub-issues
    One section per sub-issue, in order:

    #### <n>. <Title>
    Blocked-by · `hitl` and its checkpoint
    <the spec>

- **Backend spec**: follow `spec-template.md` (this folder).
- **UI spec**: what is shown, in which states (empty, loading, error, too much data), which
  actions the user has, and the API contract that feeds it. No layout, no files, no
  Given/When/Then: the design settles those.
- **Name what crosses a sub-issue boundary**: routes, schemas, bus events, tables. Names and
  data shapes, never code bodies.
- **Pin down what is expensive to correct or that the human decided. Leave free what is cheap.**
- **A broken flow is a defect, not a footnote.** A step ending nowhere, a piece nothing calls:
  fix it here.
- **A decision the plan leaves open comes back as a question**, never as a guess: put it to the
  human (on the same page, as a further round), record the answer in the ledger, then go on.

**Three checks, once, on this document.** A failure is a defect in the split, not a note on the
ticket: resplit or add a sub-issue, and take a changed split back to step 6.

- **Seams match.** Walk the flow. Every step whose ends land in different sub-issues is a shared
  contract: both specs give it the same name and shape. A step no sub-issue implements is
  dropped work.
- **File coverage.** Every file the plan names is claimed by at least one spec. Unclaimed means
  dropped: a migration, a step from `project-architecture`'s "Adding a module — checklist".
- **No criterion left unproven.** Every acceptance criterion maps to a sub-issue whose criteria
  prove its share.

## 8. Write to GitHub

Everything through `aisf:github-issue`. Each child body is its spec, **copied from the plan as
is**.

1. **The ticket.** Append `## Technical plan` to its body, replacing `## Planning so far` if
   present.
2. **Sub-issues, in dependency order**, each with `--parent`, `--blocked-by` and the ticket's
   `priority:`. Title from the `####` line, body the spec under it. Backend: its own `type:`,
   `status: ready`, `hitl` where confirmed. UI: `type: ui`; with `project-design` present, an
   idea (no `status:` label) whose body is the plan's UI spec; otherwise `status: backlog`.
3. **Backfill** the plan with the real sub-issue numbers, guard `plan → planned`, and check
   the count landed. Write each backfilled body to a **new file**, never over its source.

   ```bash
   gh issue view <n> --json subIssuesSummary --jq .subIssuesSummary.total
   ```

**Fits one PR:** `## Technical plan`, then its one spec under `## Spec` in place of
`### Sub-issues`, go on the ticket itself. Then guard `plan → ready`.

**UI only:** the UI spec goes on the ticket itself, its `type:` becomes `type: ui`, then
guard `plan → backlog`. With `project-design` present: drop the `status:` label instead (`plan → idea`).

Report every number written and what `aisf:implement-ticket` can pick up next. For a UI ticket:
with `project-design`, it starts its design run by itself; otherwise it needs a design before
`aisf:ui-ticket <n>`.
