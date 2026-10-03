# Rework

The ticket is `in-review` and its PR needs work. These replace the named steps of `SKILL.md`.

## §3 Claim and branch

Claim first: guarded `in-review → in-progress`. Then, on a clean tree (a dirty tree: `SKILL.md` §3), `git fetch origin` and
switch to the PR's `headRefName`.

**Conflicts:** `git rebase origin/main`, then re-run §5. Never merge `origin/main` in: a merge
commit blocks the app's rebase-merge.

## §4 Implement

The work list replaces the scenarios: each unresolved review thread (GraphQL
`reviewThreads`, keep each comment's `databaseId`), each changes-requested review body,
failing checks, conflicts. Each item is a normal TDD change. One that contradicts the spec or
needs a judgement call → **escalate `spec`**. Track item → commit.

## §7 Verify AC

Every work-list item gets evidence too.

## §10 PR

`git push`, or `--force-with-lease` after a rebase. No new PR.

1. Reply under each review comment with what changed and the SHA
   (`gh api repos/{owner}/{repo}/pulls/<pr>/comments/<databaseId>/replies -f body=…`). A review
   body gets one PR comment quoting it.
2. **Never resolve a thread.** That is the reviewer's call.
3. Re-request review from each reviewer who requested changes.
4. Update the PR body if evidence or decisions changed.
5. Guarded `in-progress → in-review`.
