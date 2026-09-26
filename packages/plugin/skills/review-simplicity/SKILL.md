---
name: review-simplicity
description: >
  Post-implementation simplicity review: launches read-only aisf:simplicity-reviewer agents
  against the working diff, applies only the simplification fixes the calling agent is fully
  confident are safe (tests stay green, ACs stay met, no visible/behavioral change), returns
  architecture breaches to the caller as must-fix, and reports bugs or missing-ticket-scope
  findings without touching them. Called by aisf:implement-ticket, or any project skill that
  implements, after acceptance criteria are verified and before commit.
---

# review-simplicity

Runs after AC verification, before commit. No user interaction — the calling agent decides
alone what to apply.

**Project slots.** Load `project-architecture` and `project-toolchain` with the Skill tool
(bare names). If either returns `Unknown skill`, stop and report "project not onboarded".
Do not improvise commands or rules.

## 1 — Gather the diff

`git diff HEAD` plus `git status --porcelain` for new files. This is the diff about to be
committed. In a rework run it is only the rework diff, which is what gets reviewed.

## 2 — Review (parallel agents, read-only)

Launch `aisf:simplicity-reviewer` agents in one message, one per angle group below. Give each
the diff from §1 and the file path of every skill `project-architecture` names under
`## Load also` (find them with Glob, e.g. `**/skills/<name>/SKILL.md`), so the agent can Read
them. The agent has `project-architecture` preloaded and cannot edit. Each returns `file`,
`line`, a one-line `summary`, its category, and why the fix is safe or unsafe to auto-apply.

### Simplicity (four angles)

- **Reuse** — new code that reimplements something the codebase already has, including
  shared code where `project-architecture` says it lives.
- **Simplification** — redundant/derivable state, copy-paste variants, deep nesting, dead code,
  needless complexity (indirection, abstraction, or generality nothing in the diff needs — a
  wrapper used once, a config knob with one caller, a class where a function would do).
- **Efficiency** — wasted work: redundant computation, sequential independent operations,
  closures/objects capturing more of their environment than they need.
- **Altitude** — a special case layered on shared infrastructure instead of fixing the
  mechanism at the right depth, as `project-architecture` places it.

A finding only belongs here if applying it changes nothing observable: same test results, same
ACs, same visible behavior. A fix that would change behavior isn't a simplicity finding —
route it to Bugs & gaps instead.

### Architecture

- A change in the diff that breaks an entry in `project-architecture` `## Placement rules` or
  `## Hard bans`. Each finding names the rule it breaks.

Returned to the caller as must-fix. Never applied by this skill.

### Bugs & gaps

- **Bug** — noticed while reading the diff, not caught by the ticket's tests.
- **Gap** — functionality that reads like an obvious part of the ticket's intent but isn't
  covered by an AC.

Report-only. Never applied by this skill.

## 3 — Apply (no interaction, no asking)

Take the commands from the `aisf-toolchain` block in `project-toolchain`.

For each simplicity finding: apply it only if certain it changes nothing behavioral or visual
and tests will stay green. After applying a batch, re-run the affected tests with `test_file`,
then the full suite with `test`, then `analyze`. Read `analyze` output as the prose under the
block describes.

Not certain → discard silently, no explanation owed per item. A fix applied and then found to
break a test or `analyze` gets reverted, not patched further — never leave a half-applied
finding.

Architecture findings are never applied here: the caller fixes them. Bug/gap findings are never
applied here either; fixing a bug is a behavior change and outside scope.

## 4 — Report

One short block for the calling skill's final report:

- **Applied** — count, and one line each: `file:line` — what changed.
- **Discarded** — count only.
- **Architecture (must-fix)** — one line each: `file:line` — the rule broken. The caller
  fixes each, re-runs Green, then runs `aisf:review-simplicity` again. A fix that needs a
  judgement call is escalated (unattended) or asked about (by hand), not guessed.
- **Bugs/gaps** — if the `aisf_report_finding` tool is available, report each finding through
  it (`kind` bug or gap, `file:line`, `summary`, the ticket `#n` from the `aisf/<n>-*` branch)
  and give only the count here. Otherwise list one line each — `kind` `file:line` — what —
  and the caller puts them in the PR body under `## Known bugs`.

Nothing found in a category → omit that line.
