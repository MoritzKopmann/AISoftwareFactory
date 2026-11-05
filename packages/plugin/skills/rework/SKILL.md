---
name: rework
description: >
  Rework of an in-review ticket whose PR needs work: claim, rebase on main, the work list, one
  commit and evidence per item, force-with-lease push, PR replies, back to review. Use when a
  run finds its ticket in rework.
---

# rework

Read by the running builder, as an extension of its own process. When the ticket is `in-review`
and its PR needs work, each section below replaces the builder's step of the same role. The
agent already holds `<n>`, the PR and `--since <ISO time>` (when the app's last run ended).

Goal: every review item handled, the PR updated in place, the ticket back in `in-review`.

- Every stop and escalate goes through the builder's own stop points (AFK or hand-run).
- Every status change goes through `aisf:github-issue`.
- Rebase, never merge `origin/main` in: a merge commit blocks the app's rebase-merge.
- Push only with `--force-with-lease`. A review thread is the reviewer's to resolve.

## Claim

Replaces the builder's claim. Guarded `in-review → in-progress` via `aisf:github-issue`. A guard
mismatch → stop, report the actual state.

Done when the ticket is `in-progress`.

## Branch

On a clean tree (a dirty tree: the builder's own dirty-tree rule): `git fetch origin`, switch to
the PR's `headRefName`, `git rebase origin/main`. Then run the builder's check step. A rebase
you cannot finish → escalate `red`.

Done when the branch is rebased and the builder's checks are green.

## Work list

The work list replaces the spec's work. List:

- each unresolved review thread (`gh api graphql`, `reviewThreads`; keep each comment's `databaseId`)
- each review body and PR conversation comment created after `--since`
- failing checks
- conflicts

Without `--since`: no review bodies or conversation comments.

Per item: the builder's change-and-check step, then the builder's commit step, so each item has
its own commit. Track item → SHA. A rebase alone (no other item) needs no new commit. An item
that contradicts the spec or needs a judgement call → escalate `spec`.

Done when every item is changed, green and committed, and the item → SHA list is written.

## Evidence

In the builder's verify step, every work-list item gets evidence beside the criteria.

Done when every item has one evidence line.

## PR

Replaces the builder's PR step.

1. `git push --force-with-lease` to the same branch. No new PR.
2. Reply under each handled review comment with what changed and its SHA
   (`gh api repos/{owner}/{repo}/pulls/<pr>/comments/<databaseId>/replies -f body=…`). A handled
   review body or conversation comment gets one PR comment quoting it, with its SHA.
3. Re-request review from every reviewer whose item was handled.
4. Rewrite the PR body with `aisf:pr` from `origin/main...HEAD`, keep `Closes #<n>`, then
   `gh pr edit <pr> --body-file <tmp>`.
5. If the PR has the `approved` label, remove it (`gh pr edit <pr> --remove-label approved`).
   The human re-approves.
6. Guarded `in-progress → in-review`.

Done when the ticket is `in-review`.
