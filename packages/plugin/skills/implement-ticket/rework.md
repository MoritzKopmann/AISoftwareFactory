# Rework

The ticket is `status: in-review` and its PR needs work. The sections below change the named
step of `SKILL.md`. Every other step runs as written.

## §3 Branch

On a clean tree: `git fetch origin && git switch <branch>` (the PR's `headRefName`). Then guard
`in-review → in-progress`.

**Conflicts:** `git rebase origin/main`, resolve each step, re-run §5. Never merge
`origin/main` into the branch: a merge commit blocks the app's rebase-merge.

## §4 Implement

The work list replaces the scenarios: each unresolved review thread, the body of each review
that requested changes, failing checks, conflicts. Fetch the threads:

```bash
gh api graphql -F owner='{owner}' -F repo='{repo}' -F pr=<pr> -f query='
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) { pullRequest(number: $pr) {
      reviewThreads(first: 100) { nodes { isResolved comments(first: 50) {
        nodes { databaseId author { login } path line body } } } } } } }'
```

Each item is a normal TDD change. One that contradicts the spec or needs a judgement call →
**escalate `spec`**. Keep a list of item → commit.

## §7 Verify AC

Every work-list item gets evidence too.

## §10 PR

`git push`, or `git push --force-with-lease` after a rebase. Never plain `--force`. No new PR:

1. **Reply under each review comment** with what changed and the commit SHA:

   ```bash
   gh api repos/{owner}/{repo}/pulls/<pr>/comments/<databaseId>/replies -f body='<reply>'
   ```

   A review body (not an inline thread) gets one PR comment quoting it:
   `gh pr comment <pr> --body-file <tmp>`.

2. **Never resolve a thread.** That is the reviewer's call.
3. Re-request review from each reviewer who requested changes:

   ```bash
   gh api -X POST repos/{owner}/{repo}/pulls/<pr>/requested_reviewers -f 'reviewers[]=<login>'
   ```

4. Update the PR body if evidence or `## Decisions made` changed.
5. Write `in-progress → in-review`.
