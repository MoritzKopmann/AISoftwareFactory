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

`gh` infers the repository from the current checkout. Never pass `-R`. Every status change
and every issue write goes through `aisf:github-issue`.

**The ticket is the whole brief.** Through §7, never load `project-architecture` or
`project-index`, and never read the body of the parent or a sibling. `aisf:review-code` checks
the architecture afterwards, uninfluenced by your choices.

**Never merge**, enable auto-merge or close a ticket. The app rebase-merges an approved PR, and
`Closes #<n>` closes the ticket.

## 0. Precondition

**Project slots.** Load `project-toolchain` with the Skill tool (bare name). `Unknown skill` →
stop and report "project not onboarded". `format`, `analyze`, `test` and `test_file` below are
the commands in its `aisf-toolchain` block.

**Read the ticket:**

```bash
gh issue view <n> --json title,body,labels,state,parent,subIssues,blockedBy
```

**Type.** `type: spike` → stop: `aisf:spike <n>`. `type: ui` → stop: it needs a design, then
`aisf:ui-ticket <design> <n>`.

**Status.**

| `status:`     | Go on as                                                           |
| ------------- | ------------------------------------------------------------------ |
| `ready`       | new run                                                            |
| `in-progress` | resume: an earlier run crashed or paused                           |
| `in-review`   | rework, if §1 finds the PR needs it. Otherwise stop                |
| `planned`     | a parent: list its ready children (§1) and stop                    |
| `backlog`     | stop: needs `aisf:create-ticket` → `plan`, then `aisf:plan-ticket` |
| `plan`        | stop: needs `aisf:plan-ticket`                                     |
| `stuck`       | stop: the human retries, starts over, or moves it back by hand     |
| none          | stop: an idea, needs `aisf:create-ticket`                          |
| closed        | stop: done                                                         |

**Spec.** A ticket that goes on must hold Scope, Landing zone and Acceptance criteria: as its
whole body on a sub-issue, under `## Spec` on a one-PR ticket. Missing → stop: needs
`aisf:plan-ticket`.

A stop here writes nothing.

**Mode.** Decide once, keep it for the run:

- **AFK**: the `aisf_escalate` tool is present **and** the ticket has no `hitl` label. No human
  is watching.
- **HITL**: otherwise. A human is in chat.

## Stop points

Where a step says **escalate** or **park**, act by mode:

| Stop point                                                                          | AFK                                                   | HITL                              |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------- |
| **escalate `red`**: a check is still failing (§5)                                   | `aisf_escalate({kind: 'red', reason})`                | show the failing output and ask   |
| **escalate `spec`**: a question the ticket doesn't answer                           | `aisf_escalate({kind: 'spec', reason})`               | ask the concrete question         |
| **escalate `denied`**: the policy hook denied the same kind of action about 3 times | `aisf_escalate({kind: 'denied', reason})`             | say what was denied and ask       |
| **park**: a hidden dependency on another ticket (§4)                                | set the blocker, comment, then `aisf_park({blocker})` | propose the blocker and ask first |

- **AFK:** the run ends at the tool call. `reason` holds what was tried, what failed (paste
  the output), and the decision a human has to make.
- **HITL:** carry on with the answer, and record it as evidence (§7) or under
  `## Decisions made` (§10).
- Never call an `aisf_*` tool that isn't present. The human says give up → `aisf:github-issue`
  _Hand-run stuck_, with the same reason text.
- A small, reversible choice the ticket leaves open, or a contradiction inside it, is not a
  stop point: make it and list it under `## Decisions made`.

## 1. Identify

**Parent** (`status: planned`). Never implemented. List its open children that are
`status: ready` and have no open blocker:

```bash
gh issue view <n> --json subIssues --jq '.subIssues.nodes[] | select(.state=="OPEN") | .number'
gh issue view <child> --json title,labels,blockedBy
```

Report one line each (`#<child>` title, `hitl` if set), in GitHub's order. **Don't pick one.**
Stop.

**Blocked.** `blockedBy` lists an open issue → stop and name it. Don't park.

**Rework** (`status: in-review`). Find the PR that closes the ticket:

```bash
gh issue view <n> --json closedByPullRequestsReferences --jq '.closedByPullRequestsReferences[].number'
gh pr view <pr> --json reviewDecision,mergeable,statusCheckRollup,reviews,headRefName,url
```

- `reviewDecision` is `CHANGES_REQUESTED`, or checks are failing, or `mergeable` is
  `CONFLICTING` → **rework**. Read `rework.md` (this folder) now: it changes §3, §4, §7 and
  §10.
- Otherwise the PR is waiting on review → stop and say so.

Name `<n>` and the mode (new / resume / rework, AFK / HITL) before touching a file.

## 2. Understand

- Load `aisf:tdd`. It loads `project-testing`.
- Read the whole ticket body, and the code its Landing zone names.
- List: the files to touch, one test per scenario, and the proof for each criterion that has
  no behaviour. No code until this list exists.
- A criterion that is vague or contradicts another → settle its reading now, keeping every
  behaviour proven.
- A criterion that needs the running app or a write outside the checkout, on a leaf without
  `hitl` → never run it. End the run now: AFK **escalate `spec`**, HITL `aisf:github-issue`
  _Hand-run stuck_.

## 3. Branch

Target: `aisf/<n>-<kebab title>`.

- **Already on `aisf/<n>-*`** → stay. Uncommitted work there belongs to this ticket: keep it.
- **Otherwise** `git status --porcelain` must be empty:
  - New run → `git fetch origin && git switch -c aisf/<n>-<kebab title> origin/main`. Never
    `checkout main`: in a worktree that fails.
  - Resume with a pushed branch → `git fetch origin && git switch <branch>`.
  - Not empty → ask the human: commit it, stash it, or drop it. **Never stash**, discard or
    carry changes across branches on your own.

Then write the status (guarded): new run `ready → in-progress`, resume nothing. A guard
mismatch → stop, report the actual state, write nothing.

## 4. Implement

Strict TDD per `aisf:tdd`: one scenario per Red-Green-Refactor cycle, every scenario covered.

- **The spec's names go into tests and code as written.**
- **Files land where the Landing zone puts them.**
- **Contracts keep their name and shape verbatim.** A sibling builds against them.
- **Stay inside Scope.** What is listed under **Out** belongs to a sibling: never edit it.
  Work the ticket needs but Scope excludes → **escalate `spec`**.

**Hidden dependency.** The ticket can't be finished until another ticket lands.

- **AFK:** find the blocking ticket or post a bare idea for it
  (`Found while implementing #<n>`), add it as a native blocker
  (`gh issue edit <n> --add-blocked-by <m>`), comment on `<n>` why. Then **park**.
- **HITL:** name the ticket that should block this one. Write nothing until the human agrees.

## 5. Green

`test` and `analyze`, both clean. Read `analyze` output as the prose under the
`aisf-toolchain` block describes.

- **Never weaken a test to get green**: no deleted assertion, loosened matcher, skipped test,
  or expectation rewritten to match the bug.
- **5 fix attempts per failing check.** An attempt is one change and a re-run. A different
  failure resets the count. Still failing → **escalate `red`** with the output.
- **A failure you did not cause isn't yours.** Unsure → run the file on a clean base, never
  with `git stash`:

  ```bash
  git fetch origin && git worktree add <tmp>/base origin/main
  # run test_file for <file> inside <tmp>/base
  git worktree remove --force <tmp>/base
  ```

  Red on main too → leave it, report it, and post a bare idea for it if no issue exists
  (`Found while implementing #<n>`).

- **Never push, and never open or update a PR, while red.**

## 6. Code review

Every run: new, resume and rework. Launch one `aisf:review-code` agent. **Its prompt is the
spec, verbatim, and nothing else**: no summary of what you built, no reasons, no hints. On a
one-PR ticket that is the `## Spec` section alone. It returns three lists:

- **Fixed** → nothing to do. It never goes in the PR.
- **Deviates from spec** → each line goes under `## Decisions made` (§10). One marked
  `contract` also gets a comment on every sibling the spec names for it (find its number by
  title among the parent's sub-issues): the old name and shape, the new one, the rule.
- **Unresolved** → **escalate `spec`**.

Then re-run §5. Never move its fixes back to get green.

## 7. Verify AC

Every criterion gets evidence, by kind:

- **A scenario** → the passing test that asserts it, named.
- **A command** (`grep -r … returns nothing`, `analyze` clean) → run it verbatim, show the
  output. Never substitute a test.
- **A human check** on a `hitl` leaf → ask in chat. The answer is the evidence.
- **Vague, contradictory or live-only** → as §2 says. Never quietly rate it green.

A gap → back to §4, then §5 to §7 again.

## 8. Simplicity review

Invoke `aisf:review-simplicity`. Then, by what it reports:

- **Applied** → re-run §5.
- **Architecture (must-fix)** → fix each, re-run §5, invoke it again. A fix that needs a
  judgement call → **escalate `spec`**.
- **Bugs/gaps** → never fix them here. Keep the count or the lines for §10's `## Known bugs`.

## 9. Commit

Invoke `aisf:commit`. It takes `refs #<n>` from the branch name. `<n>` is this leaf, never its
parent: a wrong number → amend before pushing.

## 10. PR

`git push -u origin HEAD`. Never force-push, never the default branch.

`gh pr view --json url -q .url` succeeds → the PR exists (a resumed run): reuse it. Otherwise:

```bash
gh repo view --json defaultBranchRef -q .defaultBranchRef.name
gh pr create --base <default> --title "<type>(<scope>): <ticket title>" --body-file <tmp>
gh pr view --json baseRefName -q .baseRefName
```

`<type>` and `<scope>` as `aisf:commit` chose them. No `--head`, no `--draft`. The last command
must print the default branch: otherwise `gh pr edit --base <default>`. Body:

    ## Summary
    What changed and why. Two or three lines.

    ## Acceptance criteria
    - [x] One line per criterion: the criterion, `—`, its evidence from §7 (the test name,
      the command and what it printed, or the human's answer).

    ## Decisions made
    The small, reversible choices the ticket left open, every deviation from the spec (§6),
    and every untestable-change skip from `aisf:tdd` with the proof used. Omit if none.

    ## Known bugs
    The lines from §8. Findings reported through the tool: one line,
    `Findings reported through the app: N`. Omit if none.

    Closes #<n>

An unticked box means §7 isn't done.

Write `in-progress → in-review`. **Never skip this: it is what makes the ticket findable.**

**Report** the PR URL, in one line. The PR holds the rest.
