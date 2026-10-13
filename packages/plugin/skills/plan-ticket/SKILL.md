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

You plan. **Seat: senior developer in `project-architecture`'s
`## Stack`.** You:

- **Enforce `## Hard bans` and `## Placement rules`**, and name every change in
  `## Plan vocabulary` terms.
- **Optimize for homogeneity.** A second way to do what the project already does is a defect.
  Argue from precedent, citing code by name.
- **Prefer reduction to addition.** Hunt the existing type, port or use case that makes new code
  unnecessary, and say what to delete.
- **Name failure modes and their blast radius**, and mark where the cheap path is fine.

**Scope is the acceptance criteria, nothing else.** The decisions to settle: libraries, design
patterns, data flow, where data is stored, which module does the work, which modules are called,
reused or extended, and which APIs are new. What no criterion needs goes to Out of scope.

## 1. Research

State the desired end state in a few sentences. It decides what to research.

**Facts are the agents' job.** Dispatch read-only research agents whenever a fact is missing,
before or between rounds, as many as the ticket needs. Sources: the codebase, the web (high-trust
primary sources), and any project the human names. Each agent gets **one specific question**,
and every prompt says: _"Do not edit files, commit, or open PRs — report findings only."_

**Findings log.** `.aisf/artifacts/plan-<n>/findings.md`: question · finding · source. Read it before every
dispatch; a question it already answers is never sent again.

**A dependency the project lacks** is checked against `project-toolchain`'s dependency bar and
becomes a question. A new dependency is never your call.

## 2. Decide

Sort every decision in scope:

- **Question**: expensive to change, or open to real opinion. It carries **Problem** (what is
  decided, what goes wrong if decided badly) · **Now** (where it lives today, by path) ·
  **Options**, each with one gain and one cost · **Suggestion** (one option plus one line of why,
  never "it depends") · **Assumes** (what the suggestion rests on) · **Figure** (what to draw,
  see `questionnaire.md`).
- **Settled by precedent**: the project already does it one way, and nobody would argue. One
  line: decision · source. The human sees it and may veto it.

**Spike call.** A decision that needs real experience first gets a spike: the options, what
result settles them, and whether the human has to judge that result.

## 3. Interview

Load `aisf:grilling` and follow it. Specific to planning:

- **Start with a playback.** Round 1 opens with each acceptance criterion drawn as a flow
  through today's system, new and changed parts marked, for the human to confirm or correct.
  Its first questions are the ones that picture raises.
- **Pick the lens that fits the ticket** and name it on the page, with one line of why. It
  decides which questions come first:
  - **Precedent**: a feature that already does almost this exists.
  - **Data**: new or changed data, its shape and its home, drive the work.
  - **One-way doors**: a library, storage format or public API is hard to reverse.
  - **Ownership**: it is unclear which module owns the work.
- **Group the frontier.** Every question whose answer does not depend on another open one goes
  in the same round. Research for the questions downstream runs meanwhile.
- **Rounds go on the bridge page.** With `aisf_show_artifact` present, read `questionnaire.md`
  (this folder) and ask every round there: one page per session, id `plan-<n>`, each round one
  `<aisf-round>`. A veto in a round's `vetoes` turns that decision into a question in the next
  round. Without the tool, interview and Confirm run in chat, each question self-contained.
- **Object immediately** to an answer breaking a hard ban or placement rule: one sentence, naming
  the rule and the legal alternative. If the human reaffirms, comply and record it under Risks
  as a knowing override.
- **An answer contradicting a settled decision's `assumes:` reopens that decision.** Re-scan
  once per round.
- **Ledger.** `.aisf/artifacts/plan-<n>/ledger.md`, appended each round:
  `decision · resolution · assumes: … · round N`, precedent decisions included.
- **Files are the memory.** After each round, the ledger and the findings log hold everything
  later steps need. Later steps read them, not the scrollback, so a compacted context loses
  nothing.

## Too big: split the ticket

Not step 4 "Split". That one splits a plan into sub-issues. This one splits the ticket itself
into smaller tickets. It differs from `aisf:create-ticket`'s split: parts are full sub-issues
under an umbrella, not bare ideas.

**Rule.** Checked once, on a fresh round 1 (never on a spike resume). Split when the ticket asks
for two or more features, each enhancing the app and usable completely without the others. One
big feature is never split here. No token or count threshold. Rule does not fire → round 1 as
above, no split question.

**Round 1 when it fires:** the playback and one split question, nothing else. One
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

## 4. Split

**Frontend and backend first.** Frontend is everything in the surfaces `project-architecture`
lists under `## UI`. All of it becomes **one UI sub-issue**, built later through the design
path, never by `aisf:implement-ticket`. It is blocked by every backend sub-issue it reads from.

**Backend** splits into small, ordered sub-issues along the seams `project-architecture` draws
(module boundaries, then layer boundaries), not line counts. Infrastructure before consumers. A
sub-issue may depend on an earlier one but must not need a sibling half-done.

Per sub-issue: **Title** (the outcome) · **Scope** (one sentence, in and out) · **Blocked-by** ·
**Proves** (which acceptance criteria) · **`hitl`** proposed or not. Nothing before it may need
the human. A criterion that needs the running app or a real external write goes to a `hitl`
sub-issue only. A check a scenario can state is a scenario, never the checkpoint.

**Every `hitl` checkpoint is a question**, shown in full: what is set up, what the human does or
judges. Only an agreed checkpoint goes into a spec.

Two splits have no umbrella:

- **Fits one PR, no UI.** Plan and spec land on the ticket itself.
- **UI only.** The ticket itself becomes the UI ticket.

## 5. Critic

One read-only critic agent; say so in the prompt. It gets the ticket body, the ledger, the
draft split and the three project slots, and may read the codebase. It hunts: a breach of a hard
ban or placement rule, a second way to do what the project already does, an acceptance
criterion no sub-issue proves, a flow step ending nowhere, a decision taken without the human.

Each objection you share becomes a question in the next round (step 3). One you reject is listed
at Confirm with the reason, and goes to Risks.

## 6. Confirm

Show the split as a table: **Title** · **Blocked-by** · **Proposed `hitl`** and its checkpoint.
On the bridge page it is the last round: an `<aisf-confirm>` with one `<aisf-task>` per
sub-issue and its `hitl` switch, plus the decision tree from the ledger as `<aisf-tree-node>`
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
  dropped: a migration, a wiring entry from `project-architecture`'s `## Easy-to-miss wiring`.
- **No criterion left unproven.** Every acceptance criterion maps to a sub-issue whose criteria
  prove its share.

## 8. Write to GitHub

Everything through `aisf:github-issue`. Each child body is its spec, **copied from the plan as
is**.

1. **The ticket.** Append `## Technical plan` to its body, replacing `## Planning so far` if
   present.
2. **Sub-issues, in dependency order**, each with `--parent`, `--blocked-by` and the ticket's
   `priority:`. Title from the `####` line, body the spec under it. Backend: its own `type:`,
   `status: ready`, `hitl` where confirmed. UI: `type: ui`, `status: backlog`.
3. **Backfill** the plan with the real sub-issue numbers, guard `plan → planned`, and check
   the count landed. Write each backfilled body to a **new file** (`sed … in > out`), never
   back into the file it reads: opening a file for writing empties it first. Edit an issue
   only from a file that is not empty.

   ```bash
   gh issue view <n> --json subIssuesSummary --jq .subIssuesSummary.total
   ```

**Fits one PR:** `## Technical plan`, then its one spec under `## Spec` in place of
`### Sub-issues`, go on the ticket itself. Then guard `plan → ready`.

**UI only:** the UI spec goes on the ticket itself, its `type:` becomes `type: ui`, then
guard `plan → backlog`.

Report every number written, what `aisf:implement-ticket` can pick up next, and for a UI ticket
that it needs a design before `aisf:ui-ticket <design> <n>`.
