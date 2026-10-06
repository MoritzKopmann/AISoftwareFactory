---
name: implement-ticket
description: >
  Drive a ready GitHub leaf ticket to a PR, building only from the spec on the ticket: branch,
  TDD, green checks, architecture review by aisf:review-code, acceptance criteria, simplicity
  review, commit, PR. Also resumes an in-progress ticket and reworks an in-review one whose PR
  has changes requested. Given a planned parent, lists its ready children and stops. Not for
  spike or UI tickets. Use when the user wants to implement/build/work on a ticket or issue.
  Triggers: "implement #N", "work on ticket N", "build issue N", "start on #N".
---

# implement-ticket

Drive a ready leaf to a PR. Argument: ticket number. If none, ask.

## Guard rails

- **The ticket is the whole brief.** Through §7, never load `project-architecture` or
  `project-index`, and never read a parent's or sibling's body. `aisf:review-code` checks the
  architecture afterwards.
- **Every status change and issue write goes through `aisf:github-issue`.** Never pass `-R`.
- **Never merge**, enable auto-merge or close a ticket. The app merges; `Closes #<n>` closes.
  One exception: a `hitl` leaf whose spec names no code change. You close it yourself in §10.
- **Never weaken a test**, and never push or touch a PR while red.
- Everything else is your call. No check-ins or confirmations. A choice the ticket leaves
  open, or a contradiction in it, is a decision: make it, list it under `## Decisions made`.

## Stop points

The only times to involve a human. Mode is **AFK** when the `aisf_escalate` tool is present,
**hand-run** otherwise. Decide once. `hitl` is not a mode: a `hitl` leaf runs in either mode.

| Stop point                                                 | AFK                                       | Hand-run                  |
| ---------------------------------------------------------- | ----------------------------------------- | ------------------------- |
| **escalate `red`**: a check still fails (§5)               | `aisf_escalate({kind: 'red', reason})`    | show the output, ask      |
| **escalate `spec`**: the ticket doesn't answer it          | `aisf_escalate({kind: 'spec', reason})`   | ask the concrete question |
| **escalate `denied`**: the hook denied it ~3 times         | `aisf_escalate({kind: 'denied', reason})` | say what was denied, ask  |
| **park**: hidden dependency on another ticket (§4)         | blocker + comment, `aisf_park({blocker})` | propose the blocker, ask  |
| **checkpoint**: the human checkpoint of a `hitl` leaf (§7) | `aisf_checkpoint({request})`              | ask in chat               |

`reason`: what you tried, the output, the decision needed. AFK: escalate and park end the run.
Checkpoint waits: the human's answer arrives as the `aisf_checkpoint` tool result, so carry on
from it. An "interrupted" or refused result means the app resumes this session with a prompt
that carries the answer. Never call the tool again for the same request. Hand-run carries on
with the answer; the human says give up → `aisf:github-issue` _Hand-run stuck_.
Never call an `aisf_*` tool that isn't present.

`request`: what the human must do or judge, the worktree path, the exact commands to run, and
the answer expected. It becomes a public comment on the ticket, so it holds no secrets.

## 0. Precondition

Load `project-toolchain`. `Unknown skill` → stop: "project not onboarded". Its
`aisf-toolchain` block gives `format`, `analyze`, `test`, `test_file`.

```bash
gh issue view <n> --json title,body,labels,state,parent,subIssues,blockedBy
```

Go on only for a leaf that is `status: ready` (new), `in-progress` (resume) or `in-review`
(rework, §1), not `type: spike` or `type: ui`, with Scope, Landing zone and Acceptance criteria
in its body (under `## Spec` on a one-PR ticket). `planned` → §1. Anything else → stop, name
the next step (`aisf:spike`, `aisf:ui-ticket`, `aisf:plan-ticket`, `aisf:create-ticket`, or the
human for `stuck`). A stop here writes nothing.

`status: waiting` → stop. The run waits at its human checkpoint. The human answers on the
ticket page, and the app resumes the run.

## 1. Identify

- **Parent** (`planned`): list its open children that are `ready` and unblocked, one line each
  (`#<child>` title, `hitl` if set). Don't pick one. Stop.
- **Blocked**: an open `blockedBy` → stop and name it.
- **In review**: find the PR (`closedByPullRequestsReferences`). Changes requested, failing
  checks or conflicts → **rework**: read `rework.md` now. Otherwise stop: it waits on review.

Say `<n>` and the mode (new / resume / rework, AFK / hand-run).

## 2. Understand

Load `aisf:tdd`. Read the ticket and the code its Landing zone names. List the files to touch,
one test per scenario, and the proof for each criterion without behaviour. Settle any vague
criterion's reading now. A criterion that needs the running app or a write outside the
checkout, on a leaf without `hitl` → **escalate `spec`** (hand-run: _Hand-run stuck_).

## 3. Claim and branch

**First, claim the ticket** — before any branch or file work, even if the branch exists:
guarded `ready → in-progress` (new run). Resume: nothing. Rework: per `rework.md`. A guard
mismatch → stop, report the actual state.

Then the branch, `aisf/<n>-<kebab title>`:

- Already on `aisf/<n>-*` → stay. Its uncommitted work is this ticket's.
- Otherwise, on a clean tree: `git fetch origin`, then `git switch -c <branch> origin/main`
  (new) or `git switch <branch>` (resume). Never `checkout main`.
- Non-empty `git status --porcelain` on another branch: AFK → **escalate `spec`**, naming the
  dirty files. Hand-run → ask the human to commit, stash or drop them. Neither mode stashes,
  discards or carries changes over on its own.

## 4. Implement

Strict TDD, one scenario per cycle, every scenario covered.

- The spec's names, Landing zone and contracts go in **verbatim**. A sibling builds against
  them.
- Stay inside Scope. **Out** belongs to a sibling. Needed work outside Scope → **escalate
  `spec`**.
- **Hidden dependency** (can't finish until another ticket lands): find or post a bare idea
  for it (`Found while implementing #<n>`), `gh issue edit <n> --add-blocked-by <m>`, comment
  why, **park**. Hand-run: write nothing until the human agrees.

## 5. Green

`test` and `analyze` clean, `analyze` read as the toolchain block says.

- 5 fix attempts per failing check; a new failure resets the count. Then **escalate `red`**.
- Unsure a failure is yours → run the file in a throwaway `git worktree` on `origin/main`,
  never via `git stash`. Red there too → not yours: report it, post a bare idea if none exists.

## 6. Code review

Every run. Launch one `aisf:review-code` agent whose prompt is **the spec, verbatim, nothing
else** (on a one-PR ticket: the `## Spec` section). It returns:

- **Fixed** → nothing to do.
- **Deviates from spec** → each under `## Decisions made`. A `contract` one also gets a comment
  on every sibling the spec names for it: old name and shape, new one, the rule.
- **Unresolved** → **escalate `spec`**.

Re-run §5. Never undo its fixes to get green.

## 7. Verify AC

Every criterion gets evidence:

- **Scenario** → the passing test that asserts it, by name.
- **Command** → run it verbatim, show the output. Never substitute a test.
- **Human checkpoint** (`hitl`) → finish every step the spec puts before it, then take the
  **checkpoint** stop point. Never ask a human to do any other step.
  - An answer that confirms is the evidence.
  - A defect inside Scope → fix it, then checkpoint again with a new `request`.
  - Anything else → **escalate `spec`**, quoting the answer.
  - The human's answer arrives as the `aisf_checkpoint` tool result. Carry on from it.
  - An "interrupted" or refused result (`is_error: true`, "The tool call was interrupted …
    retry if needed") means the app resumes this session with a prompt that carries the
    answer. It is the pause, not a failure. Never call the tool again for the same request.

A gap → back to §4.

## 8. Simplicity review

Invoke `aisf:review-simplicity`.

- **Applied** → re-run §5.
- **Architecture (must-fix)** → fix, re-run §5, invoke again. A judgement call → **escalate
  `spec`**.
- **Bugs/gaps** → don't fix. Carry them to `## Known bugs`.

## 9. Commit

Invoke `aisf:commit`. Its `refs #<n>` must be this leaf, never the parent.

## 10. PR

A `hitl` leaf whose spec names no code change: post the §7 evidence as a ticket comment
through `aisf:github-issue`, then `gh issue close <n>`. No push, no PR. Stop here.

Otherwise `git push -u origin HEAD`. Never force, never the default branch. Reuse an existing PR;
otherwise `gh pr create` against the default branch, title `<type>(<scope>): <ticket title>`
as `aisf:commit` chose, not draft. Check its base afterwards. Body:

    ## Summary
    What changed and why. Two or three lines.

    ## Acceptance criteria
    - [x] Each criterion — its evidence from §7.

    ## Decisions made
    Open choices, spec deviations (§6), `aisf:tdd` untestable skips with their proof. Omit if none.

    ## Known bugs
    Lines from §8, or `Findings reported through the app: N`. Omit if none.

    Closes #<n>

Then guarded `in-progress → in-review`. **Never skip it: it makes the ticket findable.**

Report the PR URL in one line.
