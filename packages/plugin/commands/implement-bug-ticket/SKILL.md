---
name: implement-bug-ticket
description: Fix a ready type: bug leaf from a red test to a PR, or rework its in-review PR.
disable-model-invocation: true
---

# implement-bug-ticket

## Role and goal

Build one ready bug leaf to an open PR: a red test from the Trigger, then the fix from the Cause. An `in-review` ticket is reworked by steps R1–R7: every rework change passes the same gates as a first build (Code review, Fix bugs, Verify AC, Commit).

## Parameters

- `<n>`: the ticket.
- `--since <ISO time>`: when the app's last run ended. Only R1 and R4 use it.

## General rules

- The ticket is the whole brief: its Reproduction, Cause, Trigger and Evidence. Through step 7, load no `project-architecture`, and read no parent's or sibling's body. `aisf:review-code` checks the architecture in step 5.
- Every status change and issue write goes through `aisf:github-issue`.
- Keep every test as strong as it is. Touch a PR only when green.
- **Green**: `test` and `analyze` from `project-toolchain` are clean; read `analyze` as its block says. A step that changes code is done only when green. 5 fix attempts per failing check; a new failure resets the count; 5 attempts → escalate `red`. Unsure a failure is yours → run the file in a throwaway `git worktree` on `origin/main`. Red there too → not yours: report it, post a bare idea if none exists.
- One `aisf:review-code` launch per pass through step 5.
- The fix is the implementer's decision. The PR's Summary names it; Merge danger names the other fixes weighed.
- A choice the ticket leaves open, or a contradiction in it, is a decision: make it, list it in the PR's Merge danger.
- Rework: rebase, never merge `origin/main` in: a merge commit blocks the app's rebase-merge.
- Rework: a review thread is the reviewer's to resolve.
- Rework: one commit per rework run. Items stay uncommitted through 4 → 5 → 6 → 7; step 8 commits them once. Steps 5 and 6 read the uncommitted diff as in a first build.

Escapes inside `aisf:pr` are not drawn: the owner's Exits hold them.

## Steps

### 1. Read

- Goal: a ready bug leaf claimed; or an `in-review` ticket handed to R1.
- Actions: read the ticket. A `type: bug` leaf at `status: ready` with `## Reproduction`, `## Cause` and `## Trigger` in its body: guard `ready → in-progress`. `in-review` → R1.
- Uses: `aisf:github-issue`.
- Done: the ticket is `in-progress`, handed to R1, or the run stopped.
- Exits:
  - ready `type: bug` leaf with Reproduction, Cause and Trigger, claimed → 2
  - `in-review` → R1
  - anything else, a missing section, or guard mismatch → stop: say why, write nothing

### 2. Understand

- Goal: the fix chosen, the red test planned.
- Actions: load `aisf:tdd`. Read the ticket and the code at its Cause. Pick the fix; keep the other fixes weighed. Plan one test from the Trigger. Evidence says hand check → note a hand-check bug, plan no test.
- Uses: `aisf:tdd`.
- Done: the fix is chosen; one test is planned, or the bug is noted as hand-check.
- Output: the fix and the other fixes weighed.
- Exits:
  - fix chosen, test planned or hand-check noted → 3

### 3. Red test

- Goal: a test that fails because of the bug, before any code changes.
- Actions: per `aisf:tdd`, write the test from the Trigger and run it on today's code. It must fail for the Cause, not for setup: read the failure message. A setup failure → fix the test, run again. Hand-check bug: no test.
- Uses: `aisf:tdd`.
- Done: the test fails for the Cause; or a hand-check bug has no test.
- Output: the red test, by name, and its failure output.
- Exits:
  - the test fails for the Cause → 4
  - hand-check bug → 4
  - the test passes on today's code → escalate `spec`, with the test and its output

### 4. Fix

- Goal: the test passes; green.
- Actions: fix from the Cause per `aisf:tdd` until the red test passes. Then make it green. Hidden dependency (can't finish until another ticket lands): find or post a bare idea for it, `gh issue edit <n> --add-blocked-by <m>`, comment why, `aisf_park`. Rework → the R4 work list is the scope: change every item by TDD.
- Uses: `aisf:tdd`, `project-toolchain`, `aisf:github-issue`, `aisf_park`.
- Done: the red test passes (a hand-check bug: the fix at the Cause is in); green. Rework → every item changed.
- Exits:
  - fix in, green → 5
  - the fix needs work outside the Cause → escalate `spec`
  - rework item contradicts the ticket or needs a judgement call → escalate `spec`
  - 5 fix attempts on a check → escalate `red`
  - hidden dependency, blocker linked → stop via `aisf_park`

### 5. Code review

- Goal: the architecture checked against the ticket; suspected bugs and gaps in hand.
- Actions: launch one `aisf:review-code` agent whose prompt is the ticket body, verbatim, nothing else. Fixed → keep. Deviates from the ticket → each in the PR's Merge danger. Suspected bugs and gaps → hand the list to 6. Make it green.
- Uses: `aisf:review-code`.
- Done: its result handled; green.
- Output: the Suspected bugs and gaps list, and the deviation lines for Merge danger.
- Exits:
  - suspected bugs or gaps listed → 6
  - none listed, green → 7
  - a deviation left unresolved → escalate `spec`
  - 5 fix attempts on a check → escalate `red`

### 6. Fix bugs

- Goal: every line of the Suspected bugs and gaps list handled.
- Actions: per line:
  - **Bug**: write a failing test from its failure scenario, per `aisf:tdd`.
    - The test passes on today's code → delete the test, move on.
    - The fix would reach outside the Cause or contradict the ticket → `aisf_report_finding` (`kind` bug, `location` file:line, `summary`), one line in Merge danger, no fix.
    - Else fix it; the test passes.
  - **Gap**: `aisf_report_finding` (`kind` gap), one line in Merge danger. No code.

  Then make it green. A fixed bug is not recorded in the PR body: its test in the diff is the record.

- Uses: `aisf:tdd`, `aisf_report_finding`.
- Done: every line fixed, dropped or reported; green.
- Output: the Merge danger lines for reported bugs and gaps.
- Exits:
  - every line handled, green → 7
  - 5 fix attempts on a check → escalate `red`

### 7. Verify AC

- Goal: evidence for every criterion.
- Actions: each criterion → the red test from step 3, by name, now passing. Hand-check bug: the evidence is the Trigger steps, written for the PR reviewer to run. This step holds no `hitl` checkpoint. Rework → every work-list item gets one evidence line beside the criteria.
- Done: every criterion has evidence. Rework → every item has evidence.
- Output: the evidence for the PR.
- Exits:
  - every criterion has evidence, rework: every item too → 8
  - a gap → 4, then 5 and 6 again before 7. The evidence (step 7's Output) is void: step 7 builds it anew. The code, tests and fixes made so far carry over.

### 8. Commit

- Goal: one commit.
- Actions: invoke `aisf:commit`.
- Uses: `aisf:commit`.
- Done: committed.
- Exits:
  - committed, new build → 9
  - committed, rework → R5

### 9. PR

- Goal: the PR open, the ticket `in-review`.
- Actions: invoke `aisf:pr` with the step 7 evidence. The Summary names the fix. Merge danger names the other fixes weighed (step 2) and carries the lines from 5 and 6.
- Uses: `aisf:pr`.
- Done: PR open and the ticket `in-review`.
- Exits:
  - PR open and ticket `in-review` → done

### R1. Detect

- Goal: decide whether the in-review ticket is rework.
- Actions: find the PR via `closedByPullRequestsReferences`. It is rework when exactly one open PR exists, it has no `approved` label unless it conflicts, and at least one holds:
  - it conflicts with `origin/main` (GitHub `mergeable` is `CONFLICTING`; `UNKNOWN` counts as no conflict, as in the app),
  - it has review activity after `--since` (a review with text or comments, or a PR conversation comment); without `--since` this trigger does not apply,
  - it has unresolved review threads.
- Uses: `aisf:github-issue` (issue read), `gh pr view`, `gh api graphql` (`reviewThreads`).
- Done: rework or not rework is decided.
- Output: the PR number, and which triggers hold.
- Exits:
  - rework → R2
  - not rework → stop, write nothing: it waits on review

### R2. Claim

- Goal: the ticket is `in-progress`.
- Actions: guarded `in-review → in-progress`.
- Uses: `aisf:github-issue`.
- Done: the ticket is `in-progress`.
- Exits:
  - claimed → R3
  - guard mismatch → stop

### R3. Rebase

- Goal: the current branch rebased on `origin/main`, green.
- Actions: `git status --porcelain`; non-empty → escalate `spec`, naming the dirty files. Else `git fetch origin`, `git rebase origin/main` on the current branch. Then make it green (General rules).
- Uses: `git`, `project-toolchain`, `aisf_escalate`.
- Done: the branch is rebased; green.
- Output: the rebased branch.
- Exits:
  - rebased, green → R4
  - dirty tree → escalate `spec`
  - rebase cannot finish, or 5 fix attempts on a check → escalate `red`

### R4. Work list

- Goal: every review item listed; the list is the scope of this rework run.
- Actions: list each unresolved review thread (keep each comment's `databaseId`), each review body and PR conversation comment created after `--since` (none without `--since`), failing checks, conflicts. A rebase alone is no item.
- Uses: `gh api graphql` (`reviewThreads`), `gh pr view`, `gh pr checks`.
- Done: every item is on the list.
- Output: the work list.
- Exits:
  - work list written, at least one item → 4, then 5, 6, 7 and 8 again (each pass through 5 is one review launch). The rebased branch and the work list carry over.
  - rebase only, no item → R5

### R5. Unapprove

- Goal: the human re-approves the reworked PR. The app auto-merges an `in-review` PR with `approved`, so the label must go before R6 moves the ticket to `in-review`.
- Actions: if the PR has the `approved` label: `gh pr edit <pr> --remove-label approved`.
- Uses: `gh`.
- Done: the PR has no `approved` label.
- Exits:
  - the PR has no `approved` label → R6

### R6. PR

- Goal: the PR updated in place and the ticket `in-review`.
- Actions: load `aisf:pr` as a rework run, with the evidence from step 7. It pushes with lease, rewrites the body and keeps `Closes #<n>`, and moves the ticket to `in-review`. No new PR.
- Uses: `aisf:pr`.
- Done: `aisf:pr` is done: PR updated, ticket `in-review`.
- Output: the PR URL.
- Exits:
  - PR updated, ticket `in-review` → R7
  - `aisf:pr` escalates → escalate

### R7. Replies

- Goal: every reviewer knows what changed, by the rework commit's SHA, which is on GitHub.
- Actions: reply under each handled review comment with what changed for it and the rework commit's SHA (`gh api repos/{owner}/{repo}/pulls/<pr>/comments/<databaseId>/replies -f body=…`). A handled review body or conversation comment gets one PR comment quoting it, with the SHA. Re-request review from every reviewer whose item was handled. A rebase-only run has no item and no reply.
- Uses: `gh api`, `gh pr edit --add-reviewer`.
- Done: every handled item has a reply, and review is re-requested from each of their reviewers.
- Output: the replies.
- Exits:
  - every handled item has a reply and review is re-requested from each of their reviewers → done

## Output

An open PR and the ticket `in-review`; or a rework done: the PR updated in place (rebased, one rework commit, pushed with lease, body rewritten), no `approved` label, a reply per handled item with the rework SHA, review re-requested, the ticket `in-review`. Not rework: nothing written.

Merge danger also lists the fixes weighed, reported gaps and bugs outside the Cause.
