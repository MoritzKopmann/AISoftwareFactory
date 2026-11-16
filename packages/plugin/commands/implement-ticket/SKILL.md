---
name: implement-ticket
description: Build a ready code leaf to a PR from its spec, or rework its in-review PR.
disable-model-invocation: true
---

# implement-ticket

## Role and goal

Build one ready code leaf to an open PR, from the spec on the ticket alone. An `in-review` ticket is reworked by steps R1–R7: every rework change passes the same gates as a first build (Green, Code review, Verify AC, Simplicity review, Commit).

## Parameters

- `<n>`: the ticket.
- `--since <ISO time>`: when the app's last run ended. Only R1 and R4 use it.

## General rules

- The ticket is the whole brief. Through step 6, load no `project-architecture` or `project-index`, and read no parent's or sibling's body. `aisf:review-code` checks the architecture in step 5.
- Every status change and issue write goes through `aisf:github-issue`.
- Keep every test as strong as it is. Touch a PR only when green.
- A choice the ticket leaves open, or a contradiction in it, is a decision: make it, list it in the PR's Merge danger.
- Rework: rebase, never merge `origin/main` in: a merge commit blocks the app's rebase-merge.
- Rework: a review thread is the reviewer's to resolve.
- Rework: one commit per rework run. Items stay uncommitted through 3 → 4 → 5 → 6 → 7; step 8 commits them once. Steps 5 and 7 read the uncommitted diff as in a first build.

## Graph

```mermaid
flowchart TD
  1[1 Read] -->|ready leaf with a spec, claimed| 2[2 Understand]
  1 -->|in-review| R1[R1 Detect]
  1 -->|anything else, or guard mismatch| S((stop))
  2 -->|plan listed| 3[3 Implement]
  2 -->|criterion needs the running app, no hitl| E((escalate))
  3 -->|every scenario built, rework: every item changed| 4[4 Green]
  3 -->|work outside Scope, rework item contradicts the spec or needs judgement| E
  3 -->|hidden dependency: blocker linked, aisf_park| S
  4 -->|green, or back to 6 / 7| 5[5 Code review]
  4 -->|5 fix attempts on a check| E
  5 -->|fixes applied: re-run green| 4
  5 -->|green after review| 6[6 Verify AC]
  5 -->|unresolved| E
  6 -->|every criterion has evidence, rework: every item too| 7[7 Simplicity review]
  6 -->|a gap, or hitl defect inside Scope| 3
  6 -->|hitl answer outside Scope| E
  7 -->|applied or must-fix fixed: re-run green, then 7 again| 4
  7 -->|no must-fix left| 8[8 Commit]
  7 -->|must-fix needs judgement| E
  8 -->|committed, new build| 9[9 PR]
  8 -->|committed, rework| R5[R5 Unapprove]
  9 -->|PR open, in-review; or hitl no-code leaf closed| D((done))
  R1 -->|rework| R2[R2 Claim]
  R1 -->|not rework| S
  R2 -->|claimed| R3[R3 Rebase]
  R2 -->|guard mismatch| S
  R3 -->|rebased, green: step 4| R4[R4 Work list]
  R3 -->|dirty tree: spec, rebase cannot finish: red| E
  R4 -->|work list written, items left| 3
  R4 -->|rebase only, no item| R5
  R5 -->|label gone or absent| R6[R6 PR]
  R6 -->|PR updated, ticket in-review| R7[R7 Replies]
  R6 -->|aisf:pr escalates| E
  R7 -->|every handled item replied, review re-requested| D
```

Escapes inside `aisf:pr` are not drawn: the owner's graph holds them.

## Steps

### 1. Read

- Goal: a ready code leaf with a spec, claimed; or an `in-review` ticket handed to R1.
- Actions: read the ticket. A leaf at `status: ready` with Scope, Landing zone and Acceptance criteria in its body (under `## Spec` on a one-PR ticket): guard `ready → in-progress`. `in-review` → R1.
- Uses: `aisf:github-issue`.
- Done: the ticket is `in-progress`, handed to R1, or the run stopped.
- Exits: ready leaf with a spec, claimed → 2 · `in-review` → R1 · anything else, or guard mismatch → stop: say why, write nothing.

### 2. Understand

- Goal: a plan of the build.
- Actions: load `aisf:tdd`. Read the ticket and the code its Landing zone names. List the files to touch, one test per scenario, and the proof for each criterion without behaviour. Settle every vague criterion's reading now.
- Uses: `aisf:tdd`.
- Done: every criterion has a test or a proof in the list.
- Exits: plan listed → 3 · a criterion needs the running app or a write outside the checkout, on a leaf without `hitl` → escalate `spec`.

### 3. Implement

- Goal: every scenario built, inside Scope.
- Actions: TDD per `aisf:tdd`. The spec's names, Landing zone and contracts go in verbatim: a sibling builds against them. Scope's Out belongs to a sibling. Hidden dependency (can't finish until another ticket lands): find or post a bare idea for it, `gh issue edit <n> --add-blocked-by <m>`, comment why, `aisf_park`. Rework → the R4 work list is the scope: change every item by TDD.
- Uses: `aisf:tdd`, `aisf:github-issue`, `aisf_park`.
- Done: every scenario has a passing test. Rework → every item changed.
- Exits: every scenario built → 4 · needed work outside Scope → escalate `spec` · rework item contradicts the spec or needs a judgement call → escalate `spec` · hidden dependency, blocker linked → stop via `aisf_park`.

### 4. Green

- Goal: `test` and `analyze` clean.
- Actions: run `test` and `analyze` from `project-toolchain`; read `analyze` as its block says. 5 fix attempts per failing check; a new failure resets the count. Unsure a failure is yours → run the file in a throwaway `git worktree` on `origin/main`. Red there too → not yours: report it, post a bare idea if none exists.
- Uses: `project-toolchain`.
- Done: both clean.
- Exits: green → 5, or back to the step that sent here (5 → 6, 7 → 7) · 5 fix attempts on a check → escalate `red`.

### 5. Code review

- Goal: the architecture checked against the spec.
- Actions: launch one `aisf:review-code` agent whose prompt is the spec, verbatim, nothing else (on a one-PR ticket: the `## Spec` section). Fixed → nothing. Deviates from spec → each in the PR's Merge danger; a `contract` one also gets a comment on every sibling the spec names for it: old name and shape, new one, the rule. Re-run 4; keep its fixes.
- Uses: `aisf:review-code`.
- Done: its result handled, green.
- Exits: fixes applied → 4 · green after review → 6 · unresolved → escalate `spec`.

### 6. Verify AC

- Goal: evidence for every criterion.
- Actions: scenario → the passing test that asserts it, by name. Command → run it verbatim, show the output; never a test in its place. `hitl` checkpoint → finish every step the spec puts before it, then `aisf_checkpoint`. The request holds only what no test or command proves. An answer that confirms is the evidence. A defect inside Scope → fix, checkpoint again with a new request. Rework → every work-list item gets one evidence line beside the criteria.
- Uses: `aisf_checkpoint` (`hitl` only).
- Done: every criterion has evidence. Rework → every item has evidence.
- Output: the evidence for the PR.
- Exits: every criterion has evidence → 7 · a gap, or a `hitl` defect inside Scope → 3 · `hitl` answer outside Scope → escalate `spec`, quoting it.

### 7. Simplicity review

- Goal: the diff simplified.
- Actions: invoke `aisf:review-simplicity` and handle its report as it says.
- Uses: `aisf:review-simplicity`.
- Done: no must-fix left.
- Exits: applied, or must-fix fixed → 4, then 7 again · no must-fix left → 8 · must-fix needs judgement → escalate `spec`.

### 8. Commit

- Goal: one commit.
- Actions: invoke `aisf:commit`.
- Uses: `aisf:commit`.
- Done: committed.
- Exits: committed, new build → 9 · committed, rework → R5.

### 9. PR

- Goal: the work shipped, the ticket findable.
- Actions: a `hitl` leaf whose spec names no code change → post the step 6 evidence as a ticket comment, close the ticket; no push, no PR. Otherwise invoke `aisf:pr` with the step 6 evidence.
- Uses: `aisf:pr`, `aisf:github-issue`.
- Done: PR open and ticket `in-review`; or the `hitl` no-code leaf closed.
- Exits: → done.

### R1. Detect

- Goal: decide whether the in-review ticket is rework.
- Actions: find the PR via `closedByPullRequestsReferences`. It is rework when exactly one open PR exists, it has no `approved` label unless it conflicts, and at least one holds:
  - it conflicts with `origin/main` (GitHub `mergeable` is `CONFLICTING`; `UNKNOWN` counts as no conflict, as in the app),
  - it has review activity after `--since` (a review with text or comments, or a PR conversation comment); without `--since` this trigger does not apply,
  - it has unresolved review threads.
- Uses: `aisf:github-issue` (issue read), `gh pr view`, `gh api graphql` (`reviewThreads`).
- Done: rework or not rework is decided.
- Output: the PR number, and which triggers hold.
- Exits: rework → R2 · not rework → stop, write nothing: it waits on review.

### R2. Claim

- Goal: the ticket is `in-progress`.
- Actions: guarded `in-review → in-progress`.
- Uses: `aisf:github-issue`.
- Done: the ticket is `in-progress`.
- Exits: claimed → R3 · guard mismatch → stop.

### R3. Rebase

- Goal: the current branch rebased on `origin/main`, `test` and `analyze` clean.
- Actions: `git status --porcelain`; non-empty → escalate `spec`, naming the dirty files. Else `git fetch origin`, `git rebase origin/main` on the current branch. Then run step 4 Green's actions.
- Uses: `git`, step 4 Green, `aisf_escalate`.
- Done: the branch is rebased and `test` and `analyze` are clean.
- Output: the rebased branch.
- Exits: rebased, green → R4 · dirty tree → escalate `spec` · rebase cannot finish → escalate `red`.

### R4. Work list

- Goal: every review item listed; the list is the scope of this rework run.
- Actions: list each unresolved review thread (keep each comment's `databaseId`), each review body and PR conversation comment created after `--since` (none without `--since`), failing checks, conflicts. A rebase alone is no item.
- Uses: `gh api graphql` (`reviewThreads`), `gh pr view`, `gh pr checks`.
- Done: every item is on the list.
- Output: the work list.
- Exits: work list written, items left → 3 · rebase only, no item → R5.

### R5. Unapprove

- Goal: the human re-approves the reworked PR. The app auto-merges an `in-review` PR with `approved`, so the label must go before R6 moves the ticket to `in-review`.
- Actions: if the PR has the `approved` label: `gh pr edit <pr> --remove-label approved`.
- Uses: `gh`.
- Done: the PR has no `approved` label.
- Exits: label gone or absent → R6.

### R6. PR

- Goal: the PR updated in place and the ticket `in-review`.
- Actions: load `aisf:pr` as a rework run, with the evidence from step 6. It pushes with lease, rewrites the body and keeps `Closes #<n>`, and moves the ticket to `in-review`. No new PR.
- Uses: `aisf:pr`.
- Done: `aisf:pr` is done: PR updated, ticket `in-review`.
- Output: the PR URL.
- Exits: PR updated, ticket in-review → R7 · `aisf:pr` escalates → escalate.

### R7. Replies

- Goal: every reviewer knows what changed, by the rework commit's SHA, which is on GitHub.
- Actions: reply under each handled review comment with what changed for it and the rework commit's SHA (`gh api repos/{owner}/{repo}/pulls/<pr>/comments/<databaseId>/replies -f body=…`). A handled review body or conversation comment gets one PR comment quoting it, with the SHA. Re-request review from every reviewer whose item was handled. A rebase-only run has no item and no reply.
- Uses: `gh api`, `gh pr edit --add-reviewer`.
- Done: every handled item has a reply, and review is re-requested from each of their reviewers.
- Output: the replies.
- Exits: every handled item replied → done.

## Output

An open PR and the ticket `in-review`; or a `hitl` leaf with no code change closed with its evidence; or a rework done: the PR updated in place (rebased, one rework commit, pushed with lease, body rewritten), no `approved` label, a reply per handled item with the rework SHA, review re-requested, the ticket `in-review`. Not rework: nothing written.
