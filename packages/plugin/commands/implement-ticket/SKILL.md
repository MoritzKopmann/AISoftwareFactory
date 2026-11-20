---
name: implement-ticket
description: Build a ready code leaf to a PR from its spec, or rework its in-review PR.
disable-model-invocation: true
---

# implement-ticket

## Role and goal

Build one ready code leaf to an open PR, from the spec on the ticket alone. An `in-review` ticket is reworked by steps R1–R7: every rework change passes the same gates as a first build (Code review, Fix bugs, Verify AC, Commit).

## Parameters

- `<n>`: the ticket.
- `--since <ISO time>`: when the app's last run ended. Only R1 and R4 use it.

## General rules

- The ticket is the whole brief. Through step 6, load no `project-architecture`, and read no parent's or sibling's body. `aisf:review-code` checks the architecture in step 4.
- Every status change and issue write goes through `aisf:github-issue`.
- Keep every test as strong as it is. Touch a PR only when green.
- **Green**: `test` and `analyze` from `project-toolchain` are clean; read `analyze` as its block says. A step that changes code is done only when green. 5 fix attempts per failing check; a new failure resets the count; 5 attempts → escalate `red`. Unsure a failure is yours → run the file in a throwaway `git worktree` on `origin/main`. Red there too → not yours: report it, post a bare idea if none exists.
- One `aisf:review-code` launch per pass through step 4.
- A choice the ticket leaves open, or a contradiction in it, is a decision: make it, list it in the PR's Merge danger.
- Rework: rebase, never merge `origin/main` in: a merge commit blocks the app's rebase-merge.
- Rework: a review thread is the reviewer's to resolve.
- Rework: one commit per rework run. Items stay uncommitted through 3 → 4 → 5 → 6; step 7 commits them once. Steps 4 and 5 read the uncommitted diff as in a first build.

Escapes inside `aisf:pr` are not drawn: the owner's Exits hold them.

## Steps

### 1. Read

- Goal: a ready code leaf with a spec, claimed; or an `in-review` ticket handed to R1.
- Actions: read the ticket. A leaf at `status: ready` with Scope, Landing zone and Acceptance criteria in its body (under `## Spec` on a one-PR ticket): guard `ready → in-progress`. `in-review` → R1.
- Uses: `aisf:github-issue`.
- Done: the ticket is `in-progress`, handed to R1, or the run stopped.
- Exits:
  - ready leaf with a spec, claimed → 2
  - `in-review` → R1
  - anything else, or guard mismatch → stop: say why, write nothing

### 2. Understand

- Goal: a plan of the build.
- Actions: load `aisf:tdd`. Read the ticket and the code its Landing zone names. List the files to touch, one test per scenario, and the proof for each criterion without behaviour. Settle every vague criterion's reading now.
- Uses: `aisf:tdd`.
- Done: every criterion has a test or a proof in the list.
- Exits:
  - every criterion has a test or a proof in the list → 3
  - a criterion needs the running app or a write outside the checkout, on a leaf without `hitl` → escalate `spec`

### 3. Implement

- Goal: every scenario built, inside Scope, green.
- Actions: TDD per `aisf:tdd`. The spec's names, Landing zone and contracts go in verbatim: a sibling builds against them. Scope's Out belongs to a sibling. Hidden dependency (can't finish until another ticket lands): find or post a bare idea for it, `gh issue edit <n> --add-blocked-by <m>`, comment why, `aisf_park`. Rework → the R4 work list is the scope: change every item by TDD.
- Uses: `aisf:tdd`, `aisf:github-issue`, `aisf_park`.
- Done: every scenario has a passing test; green. Rework → every item changed.
- Exits:
  - every scenario built, green → 4
  - needed work outside Scope → escalate `spec`
  - rework item contradicts the spec or needs a judgement call → escalate `spec`
  - 5 fix attempts on a check → escalate `red`
  - hidden dependency, blocker linked → stop via `aisf_park`

### 4. Code review

- Goal: the architecture checked against the spec; suspected bugs and gaps in hand.
- Actions: launch one `aisf:review-code` agent whose prompt is the spec, verbatim, nothing else (on a one-PR ticket: the `## Spec` section). Fixed → keep. Deviates from spec → each in the PR's Merge danger; a `contract` one also gets a comment on every sibling the spec names for it: old name and shape, new one, the rule. Suspected bugs and gaps → hand the list to 5. Make it green.
- Uses: `aisf:review-code`.
- Done: its result handled; green.
- Output: the Suspected bugs and gaps list.
- Exits:
  - suspected bugs or gaps listed → 5
  - none listed, green → 6
  - a deviation left unresolved → escalate `spec`
  - 5 fix attempts on a check → escalate `red`

### 5. Fix bugs

- Goal: every line of the Suspected bugs and gaps list handled.
- Actions: per line:
  - **Bug**: write a failing test from its failure scenario, per `aisf:tdd`.
    - The test passes on today's code → delete the test, move on.
    - The fix would leave Scope or contradict the spec → `aisf_report_finding` (`kind` bug, `location` file:line, `summary`), one line in Merge danger, no fix.
    - Else fix it; the test passes.
  - **Gap**: `aisf_report_finding` (`kind` gap), one line in Merge danger. No code.

  Then make it green. A fixed bug is not recorded in the PR body: its test in the diff is the record.

- Uses: `aisf:tdd`, `aisf_report_finding`.
- Done: every line fixed, dropped or reported; green.
- Output: the Merge danger lines for reported bugs and gaps.
- Exits:
  - every line handled, green → 6
  - 5 fix attempts on a check → escalate `red`

### 6. Verify AC

- Goal: evidence for every criterion.
- Actions: scenario → the passing test that asserts it, by name. Command → run it verbatim, show the output; never a test in its place. `hitl` checkpoint → finish every step the spec puts before it, then `aisf_checkpoint`. The request holds only what no test or command proves. An answer that confirms is the evidence. A defect inside Scope → fix, checkpoint again with a new request. Rework → every work-list item gets one evidence line beside the criteria.
- Uses: `aisf_checkpoint` (`hitl` only).
- Done: every criterion has evidence. Rework → every item has evidence.
- Output: the evidence for the PR.
- Exits:
  - every criterion has evidence, rework: every item too → 7
  - a gap, or a `hitl` defect inside Scope → 3: 3, 4, 5, 6 and 7 run again. The evidence (step 6's Output) is void: step 6 builds it anew. The code, tests and fixes made so far carry over.
  - `hitl` answer outside Scope → escalate `spec`, quoting it

### 7. Commit

- Goal: one commit.
- Actions: invoke `aisf:commit`.
- Uses: `aisf:commit`.
- Done: committed.
- Exits:
  - committed, new build → 8
  - committed, rework → R5

### 8. PR

- Goal: the work shipped, the ticket findable.
- Actions: a `hitl` leaf whose spec names no code change → post the step 6 evidence as a ticket comment, close the ticket; no push, no PR. Otherwise invoke `aisf:pr` with the step 6 evidence; Merge danger also carries the lines from 4 and 5.
- Uses: `aisf:pr`, `aisf:github-issue`.
- Done: PR open and ticket `in-review`; or the `hitl` no-code leaf closed.
- Exits:
  - PR open and ticket `in-review`; or the `hitl` no-code leaf closed → done

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
  - work list written, at least one item → 3 (each pass through 4 is one review launch)
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
- Actions: load `aisf:pr` as a rework run, with the evidence from step 6. It pushes with lease, rewrites the body and keeps `Closes #<n>`, and moves the ticket to `in-review`. No new PR.
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

An open PR and the ticket `in-review`; or a `hitl` leaf with no code change closed with its evidence; or a rework done: the PR updated in place (rebased, one rework commit, pushed with lease, body rewritten), no `approved` label, a reply per handled item with the rework SHA, review re-requested, the ticket `in-review`. Not rework: nothing written.

Merge danger also lists reported gaps and out-of-Scope bugs.
