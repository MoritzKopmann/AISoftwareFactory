# Rework

The ticket is `in-review` and its PR needs work. These replace the named steps of `SKILL.md`.
`--since <ISO time>` is when the app's last run ended.

## §3 Claim and branch

Claim first: guarded `in-review → in-progress`. Then, on a clean tree (a dirty tree: `SKILL.md` §3), `git fetch origin` and
switch to the PR's `headRefName`.

**Always rebase:** `git rebase origin/main`, then re-run §5. Never merge `origin/main` in: a
merge commit blocks the app's rebase-merge. A rebase you cannot finish → **escalate `red`**.

## §4 Implement

The work list replaces the scenarios:

- each unresolved review thread (GraphQL `reviewThreads`, keep each comment's `databaseId`)
- each review body and PR conversation comment created after `--since`
- failing checks
- conflicts

Without `--since`: no review bodies or conversation comments. Old ones are never on the list.

Each item is a normal TDD change. One that contradicts the spec or needs a judgement call →
**escalate `spec`**. Track item → commit. A rebase alone (no other item) needs no new commit.

## §7 Verify AC

Every work-list item gets evidence too.

## §10 PR

Always `git push --force-with-lease` to the same branch. Never plain `--force`. No new PR.

1. Reply under each handled review comment with what changed and the SHA
   (`gh api repos/{owner}/{repo}/pulls/<pr>/comments/<databaseId>/replies -f body=…`). A handled
   review body or PR conversation comment gets one PR comment quoting it.
2. **Never resolve a thread.** That is the reviewer's call.
3. Re-request review from every reviewer whose item was handled.
4. Rewrite the PR body with `aisf:pr` from the whole branch diff (`origin/main...HEAD`), keep
   `Closes #<n>`, then `gh pr edit <pr> --body-file <tmp>`.
5. After the push, if the PR has the `approved` label, remove it
   (`gh pr edit <pr> --remove-label approved`). The human re-approves.
6. Guarded `in-progress → in-review`.
