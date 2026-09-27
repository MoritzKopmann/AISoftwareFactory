---
name: plan-ticket
description: >
  Turn a settled GitHub ticket (status: plan) into a technical plan and, where the split calls
  for it, atomic sub-issues that aisf:implement-ticket picks up one after another. Interviews
  the human in chat, always with a recommendation, until nothing is left open. Use when the user
  wants to plan a ticket or epic. Triggers: "plan #N", "plan ticket N", "plan this epic".
---

# plan-ticket

Turn a ticket at `status: plan` into a plan and, when the work doesn't fit one PR, ordered
sub-issues. Argument: ticket number. If none, ask.

`gh` infers the repository from the current checkout. Never pass `-R`. Every status change and
every issue write goes through `aisf:github-issue`.

**The agent plans, the human decides.** Research feeds one planning agent. Its plan seeds an
interview held in chat: the human answers, you always recommend. Nothing is silently assumed.

Lifecycle **plan → ready/planned → implement**: `aisf:create-ticket` settled _what_, this
settles _how_, `aisf:implement-ticket` writes the code. A sub-issue is branched and PR'd on its
own; a parent with children is a tracking umbrella with no working branch.

## Precondition

**Project slots.** Load `project-toolchain`, `project-architecture` and `project-testing` with
the Skill tool (bare names). If any returns `Unknown skill`, stop and report "project not
onboarded". Every project fact used below — stack, module layout, hard bans, placement rules,
dependency bar — comes from these slots, never from memory of another project.

**Status.**

```bash
gh issue view <n> --json title,body,labels,state
```

`status: plan` → go on. Anything else → stop and name the stage the ticket actually needs
(`status: backlog` needs nothing yet; `status: ready`/`planned` is already planned; no
`status:` label is an idea that needs `aisf:create-ticket` first).

**Spec check.** The body must state a clear desired outcome and, where the human already knows
it, its scope. Missing, vague, or self-contradictory → **stop**: through `aisf:github-issue`,
comment the concrete gaps and guard the ticket `plan → idea`. Plan quality is bounded by spec
quality; don't invent what the spec left out.

## 1. Orient

- Read the ticket. State the desired end state in a few sentences — that framing drives the
  research below.
- Load every skill `project-architecture` and `project-testing` name under `## Load also`.
- If a `project-index` skill exists, invoke its recall for every feature or module the ticket
  touches. Skip silently if it returns `Unknown skill`.

## 2. Research

Up to **3 `Explore` agents in parallel**, read-only. Every prompt says: _"Do not edit files,
commit, or open PRs — report findings only."_ Pick the lanes from the ticket — landing zone,
precedent, crossed contracts are the usual ones, not a template. One agent is enough for a small
ticket with known files.

**Library pass** — only when the ticket needs a dependency the project lacks. Check it against
`project-toolchain`'s dependency bar (maintenance, licence, platform support, size, and whether
`registry`/`manifests` already cover it). A new dependency is never the agent's call — it
becomes a question in step 4.

Findings go straight to the planning agent. Nothing is published.

## 3. Plan

One Opus subagent, read-only — say so in the prompt.

**Seat: senior developer in `project-architecture`'s `## Stack`.** Owns the business logic and,
where `## UI` says yes for the surfaces the ticket touches, what the user sees.

- Enforces `## Hard bans` and `## Placement rules`. States where things land in
  `## Plan vocabulary` terms — class types, owning module, bus events, tables.
- **Optimizes for homogeneity.** A second way to do what the project already does is a defect.
  Argues from precedent, citing code by name.
- **Prefers reduction to addition.** Hunts the existing type, port or use case that makes new
  code unnecessary — and says what to delete. No new seam until a third caller is real.
- **UX duties apply only when `## UI` is yes** for a touched surface: layout, empty, loading,
  error and too-much-data states.
- **Names failure modes before they're written** — and their blast radius.
- **Marks where the cheap path is fine**, so nothing gets gold-plated.
- **Proposes `hitl` per likely subtask**, one line of why (a human check the leaf will need, or
  none).

**Gets:** the ticket body, the research findings, `project-architecture`, `project-testing` and
`project-toolchain`. May read the codebase for anything they don't cover.

**Returns:**

1. **Plan** — approach, where each piece lands, what is reused, what is deleted. No code. A
   signature or data shape only where the plan is meaningless without it.
2. **Prototype call** — does a decision need real experience first? If yes: what it chooses
   between and what result settles it. If no, say no. Step 7 consumes this.
3. **Questions** — one row each:

   | Field          | Contents                                                                      |
   | -------------- | ----------------------------------------------------------------------------- |
   | **Question**   | Plain language, as few words as possible.                                     |
   | **Suggestion** | Its answer plus one line of why. Never "it depends".                          |
   | **Trivial**    | `yes` if already settled by existing code or an earlier decision — say which. |
   | **Assumes**    | What the suggestion rests on, `;`-separated. Omit if nothing.                 |

Decisions, not trivia. Something nobody would have an opinion about, and that is cheap to
change, doesn't belong on the list at all.

## 4. Interview

Interview the human relentlessly, **in chat**, until you reach a shared understanding. Map it as
a **design tree**: every decision branches into the decisions that hang off it.

**Root of the tree is the slice** — the thinnest end-to-end thing that satisfies the ticket, and
what it gives up. Ask it first; everything else hangs off the answer.

**Work the tree in rounds.** The frontier is every decision whose prerequisites are settled: the
questions you can ask now without guessing at answers you haven't heard yet. Ask the whole
frontier in one round, numbered, each with your recommended answer. Then wait.

**Every recommendation comes from the planning agent** — its suggestion, or what its plan
implies. Never "it depends".

Each round's answers reshape the tree: settled decisions push the frontier outward and unblock
what depended on them. Recompute, ask the next round. **A question whose answer depends on
another question still open this round belongs to a later round, not this one.**

**Finding facts is your job, never the human's.** A frontier question needing a fact from the
environment → dispatch a sub-agent. Don't block on it: a running exploration is an unsettled
prerequisite, so only its downstream waits. Ask the rest of the frontier now.

Inside the loop:

- **Object immediately** to an answer breaking a hard ban or placement rule — one sentence,
  naming the rule and the legal alternative. If the human reaffirms, comply and record it under
  Risks as a knowing override.
- **Never offer an illegal option.** A banned construct is not a choice. If the illegal design
  carries a real idea, restate it legally and ask that.
- **An answer contradicting a settled node's `assumes:` reopens that node.** Re-scan once per
  round. If collisions keep cascading, stop and say so — the design or the spec is wrong.
- **Ledger.** One scratchpad file, appended each round: `decision · resolution · assumes: … ·
round N`. Later steps read the ledger, not the scrollback.

Example. Round 1 asks the slice and where state lives — both unblocked. It does not ask the
migration, which depends on that. Round 2's frontier holds it, unblocked by Q2:

    R1  ❓ Q1 Slice: read-only first, editing later?                ➡️ yes
        ❓ Q2 Storage: extend the existing table or add a new one?  ➡️ new table
    R2  ❓ Q3 Migration: backfill existing rows, or leave them empty? ➡️ leave empty

**Done when the frontier is empty** — every branch visited, no acceptance criterion left
undecided, nothing silently assumed.

## 5. Confirm

Post, in chat, a subtask table for the split step 7 will post: **Title** · **Blocked-by** ·
**Proposed `hitl`** and its one-line reason. The human confirms it, or edits it, before anything
is written to GitHub.

**This is the only gate.** Confirmed → steps 6–8 run without further approval. Not confirmed →
reopen that branch of the design tree and go back to step 4.

## 6. Write the plan

Assemble one plan from the ledger plus the agent material that never became a question.
Synthesize; don't write a fresh second plan.

- **No code.** Pattern, location, approach. A signature or data shape only where the plan is
  ambiguous without it.
- **Pin down what is expensive to correct or that the human decided. Leave free what is cheap.**
- **Behaviour as observable outcomes**, one line each. No test design — `aisf:implement-ticket`'s
  job.

Shape:

    ## Technical Plan

    ### Summary
    What we're building, what it touches, the key decisions and why.

    ### Approach
    Pattern and structure in `project-architecture`'s terms. Where each piece lives — path,
    module, layer, class type, new or existing. What is reused rather than added.

    ### Flow
    One line per use case: entry point → what it calls → what that calls next. Catches a step
    that connects to nothing.

    ### Data model
    Entities, schema/migration changes. Omit if nothing changes.

    ### Risks / open questions
    Failure modes and blast radius · knowing human overrides · what's left to implementer
    discretion.

    ### Out of scope

    ### Subtasks
    The step 7 list, in order. Omit if the ticket doesn't split (see step 7).

**A broken flow is a defect, not a footnote.** A step ending nowhere, a piece nothing calls — fix
it here. Re-check against `project-architecture` and the patterns in the touched code before
posting. The plan is the last catch — fix violations, never transcribe them.

## 7. Decompose

**One-subtask split.** The whole ticket fits one PR: no umbrella. The plan above lands directly
on the ticket's own Dev Notes (step 8), and it moves `plan → ready`. Nothing else in this step
applies.

**Otherwise**, split into small, ordered, atomic sub-issues. Each: **Title** (the outcome) ·
**Scope** (one sentence, in and out) · **File paths** (exact, from Approach) · **Depends on**
(prior subtasks, or none) · **Verification** (which acceptance criterion it proves, as
observable behaviour).

Infrastructure before consumers. A subtask may depend on an earlier one but must not need a
sibling half-done. Split along the seams `project-architecture` draws (module boundaries, layer
boundaries), not line counts.

**Spikes.** A surviving prototype call from step 3 splits on what the verdict changes.

- **Bounded** — same shape of work whichever option wins. The spike is a subtask (`type: spike`),
  placed by its dependencies, not automatically first. Its body names the options and what
  settles them; its acceptance criterion is a decision recorded as a comment on itself, not
  shipped code. Downstream subtasks work with **any** verdict and carry `Reads the verdict from
#<spike>`; they ship `status: ready`.
- **Unbounded** — the verdict changes what the work _is_. The spike leaves this plan: post it as
  its own ticket, hold the parent at `status: plan` with a comment that planning resumes on the
  verdict, and post no sub-issues.

**Never ship a sub-issue that cannot be specified.**

Four checks before posting:

- **Seams match.** Walk the Flow. Every step whose ends land in different sub-issues is a shared
  contract — both sides must agree on the shape. A step no subtask implements is dropped work.
- **File coverage.** Every file the plan names is claimed by at least one subtask. Unclaimed
  means dropped — a migration, a wiring entry from `project-architecture`'s
  `## Easy-to-miss wiring`.
- **No criterion left unproven.** Every acceptance criterion maps to a subtask whose
  Verification proves its share.
- **Verdict independence.** With a spike in the split, read each downstream subtask as though
  every option had won. Criteria that only work for one outcome mean it's unbounded.

A failing check is a defect in the split, not a note on the ticket. Resplit or add a subtask.

## 8. Write to GitHub

Everything through `aisf:github-issue`.

**One-subtask split.** Append `## Dev Notes` (the step 6 plan in full) to the ticket's own body,
then guard `plan → ready`.

**Multi-subtask split.** Append `## Dev Notes` to the **parent's** body — the step 6 plan in
full, with placeholders for sub-issue numbers. Risks and Flow live here and nowhere else; a
sub-issue's implementer has no memory of the planning. Then, for each subtask **in dependency
order**, post a native sub-issue:

- Title (the outcome) · Scope (in, and explicitly out) · Acceptance criteria (the step 7
  Verification; Given/When/Then where it fits)
- `--parent <this ticket>`, `--blocked-by <prior subtasks>`, and `Reads the verdict from
#<spike>` in the body where it applies
- Labels: this ticket's `priority:`, `type:` per subtask (a spike is `type: spike`), plus
  `status: ready`, plus `hitl` where step 5 confirmed it

Backfill the parent Dev Notes with the real sub-issue numbers, then guard `plan → planned`.
Check the count landed:

```bash
gh issue view <n> --json subIssuesSummary --jq .subIssuesSummary.total
```

**Exception — an unbounded spike.** The parent stays `status: plan`. Dev Notes get what
research established plus the spike ticket's number and a comment that planning resumes on its
verdict, not a plan. Skip the sub-issues.

Report every ticket number written, then the ticket(s) `aisf:implement-ticket` can pick up next.

## Anti-patterns

- **Asking a question whose prerequisite is still open** — makes the human guess at an answer
  they haven't given. It belongs in a later round.
- **Asking the human a fact you could look up.** Dispatch a sub-agent.
- **Asking about trivia** — cheap-to-change internals bury the decisions that matter.
- **Trusting `trivial: yes`** — the cheapest way for a wrong decision to skip the interview.
- **Untagged assumptions** — without `assumes:` a settled node goes stale unnoticed.
- **Code in the plan** — doing the work twice.
- **Under-planning** — no locations, no patterns, so the implementer invents structure.
- **A sub-issue that needs re-planning before it can be worked.** The split was premature.
- **Letting the spec stay soft** — assuming requirements is the signal to go back to the spec.
- **Carrying architecture violations forward** — the plan is the last catch.
