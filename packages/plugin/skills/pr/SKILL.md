---
name: pr
description: Opens or updates a ticket's PR: push, body (Summary, Evidence, Merge danger), Closes, priority label, ticket to in-review. Use when a ticket's work is committed, or a rework is done.
---

# pr

## Role and goal

Loaded into a builder session once the ticket's work is committed. Ships that work as one open PR against the default branch and moves the ticket to `in-review`, so the ticket is findable.

## Parameters

- `<n>`: the ticket. The session already holds it, the evidence for the body, and whether this is a rework run. No other parameter.

## General rules

- Never merge, never enable auto-merge.
- Never push to the default branch. Never force-push without lease.
- Every issue read and status change goes through `aisf:github-issue`.

## Steps

### 1. Read

- Goal: know everything the later steps need.
- Actions: read the ticket's title and `priority:` label; the default branch (`gh repo view --json defaultBranchRef`); `<type>(<scope>)` from the subject of the commit `aisf:commit` made (`git log`); the open PR for the current branch, if any (`gh pr view --json number,url,baseRefName`).
- Uses: `aisf:github-issue`, `gh`, `git log`.
- Done: title, priority, default branch, type and scope known; open PR known or known to be absent.
- Output: these values.
- Exits:
  - title, priority, default branch, type and scope known; open PR known or known to be absent → 2

### 2. Push

- Goal: the branch is on origin.
- Actions: `git push -u origin HEAD`. In a rework run: `git push --force-with-lease`.
- Uses: `git`.
- Done: the remote branch matches `HEAD`.
- Output: the pushed branch.
- Exits:
  - the remote branch matches `HEAD` → 3
  - push rejected → escalate `red` (output pasted)

### 3. Body

- Goal: the PR body file.
- Actions: write the body from `origin/<default>...HEAD` and the session's evidence, by the template and section guidance in `references/body.md`. Append `Closes #<n>`. A rework run writes it the same way: the body is rewritten, `Closes` kept.
- Uses: `references/body.md`.
- Done: the body file has all three sections and `Closes #<n>`.
- Output: the body temp file.
- Exits:
  - the body file has all three sections and `Closes #<n>` → 4

### 4. PR

- Goal: one open, non-draft PR against the default branch, with the priority label.
- Actions: an open PR exists → `gh pr edit <pr> --body-file <tmp> --add-label "priority: <x>"`. Else `gh pr create --body-file <tmp> --label "priority: <x>" --base <default>`, title `<type>(<scope>): <ticket title>`, not draft. Then read the base; wrong → `gh pr edit <pr> --base <default>`, read again.
- Uses: `gh`.
- Done: the PR is open, not draft, has the priority label, base is the default branch.
- Output: the PR number and URL.
- Exits:
  - the PR is open, not draft, has the priority label, base is the default branch → 5
  - base still wrong after one fix → escalate `red`

### 5. In review

- Goal: the ticket is findable as in review.
- Actions: guarded `in-progress → in-review`. Never skip it: it makes the ticket findable. Report the PR URL in one line.
- Uses: `aisf:github-issue` (guarded transitions).
- Done: the ticket is `in-review`.
- Output: the PR URL line.
- Exits:
  - guard passed, the ticket is `in-review` → done
  - guard mismatch → stop, report the actual state

## Output

One open PR against the default branch, with the body, `Closes #<n>` and the priority label. The ticket is `in-review`. The PR URL reported in one line.
