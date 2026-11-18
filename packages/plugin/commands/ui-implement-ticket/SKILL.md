---
name: ui-implement-ticket
description: Build a ready type: ui leaf to a PR by render and compare, or rework its in-review PR.
disable-model-invocation: true
---

# ui-implement-ticket

## Role and goal

Build one ready `type: ui` leaf to an open PR by render and compare against its mock. An `in-review` ticket is reworked by steps R1–R7: every rework change passes the same gates as a first build (Green, Code review, Verify AC, Simplicity review, Commit).

The oracle is the mock's PNG: render the mock once, render the build, look, compare picture with picture, adjust. TDD keeps behaviour, never geometry.

## Parameters

- `<n>`: the ticket.
- `--since <ISO time>`: when the app's last run ended. Only R1 and R4 use it.

## General rules

- The ticket is the whole brief. Through step 6, load no `project-architecture` or `project-index`, and read no parent's or sibling's body. `aisf:review-code` checks the architecture in step 5.
- Every status change and issue write goes through `aisf:github-issue`.
- Keep every test as strong as it is. Touch a PR only when green.
- A choice the ticket leaves open, or a contradiction in it, is a decision: make it, list it in the PR's Merge danger.
- Images are never committed or uploaded. `.aisf/` is gitignored: never `git add -f` an image.
- Rework: rebase, never merge `origin/main` in: a merge commit blocks the app's rebase-merge.
- Rework: a review thread is the reviewer's to resolve.
- Rework: one commit per rework run. Items stay uncommitted through 3 → 4 → 5 → 6 → 7; step 8 commits them once. Steps 5 and 7 read the uncommitted diff as in a first build.

Escapes inside `aisf:pr` are not drawn: the owner's Exits hold them.

## Steps

### 1. Read

- Goal: a ready `type: ui` leaf with its mock and slots, claimed; or an `in-review` ticket handed to R1.
- Actions: read the ticket. A leaf at `status: ready` with `type: ui` and Part, Landing zone, Description, Scope and Acceptance criteria in its body (the body `aisf:ui-ticket` posts). Then check, before the claim: `project-design` loads; `project-testing` has a Visual rendering recipe (a heading named "Visual rendering", at any level); `.aisf/design/mocks/<part>.html` exists in this worktree, `<part>` from the body's Part. All hold → guard `ready → in-progress`. `in-review` → R1.
- Uses: `aisf:github-issue`, Skill tool.
- Done: the ticket is `in-progress`, handed to R1, escalated, or the run stopped.
- Exits:
  - ready ui leaf, checks hold, claimed → 2
  - the ticket is `in-review` → R1
  - a check fails → escalate `spec`, naming `project-design`, the Visual rendering recipe or the mock path
  - the ticket is anything else (no `type: ui` included), or the guard mismatches → stop: say why, write nothing

### 2. Understand

- Goal: a plan of the build, and the mock as a picture.
- Actions: read the leaf and the mock `.aisf/design/mocks/<part>.html`. Read `.aisf/design/tokens.css`. Load `aisf:tdd`, `project-design` and `project-testing`, plus each skill they name under `## Load also`. Render the whole mock once with the Visual rendering recipe in `project-testing` (`file://<abs path to the mock>` in place of the URL). Window as wide as the mock, tall enough to hold every state copy in both themes. Write the PNG to `.aisf/render/<part>-mock.png` and Read it: it is what you build against. Find in it each state × theme copy the plan needs: the copy with that `data-theme` and that state's caption. List the files, the states, the behaviours and the test for each, and the visual proof per checklist line. Settle every vague criterion's reading now. A leaf that replaces a component: deleting it is part of the job.
- Uses: `aisf:tdd`, `project-design`, `project-testing`.
- Done: every criterion has a test or a proof in the list; `.aisf/render/<part>-mock.png` exists and every state × theme copy is found in it.
- Output: the plan; `.aisf/render/<part>-mock.png`.
- Exits:
  - plan listed, mock PNG read → 3
  - a criterion is vague or unprovable → escalate `spec`
  - the mock render fails → escalate `spec`, naming the mock path

### 3. Build

- Goal: every behaviour built by TDD, every checklist line matching the mock PNG or carrying a stated reason, inside Scope.
- Actions:
  - Behaviour: TDD per `aisf:tdd`: what a click or key does, which state a view model describes for each input, callbacks, navigation. Assert behaviour only, never geometry: no padding, radius or colour equality, no counting wrapper elements. Test layout follows `project-testing`.
  - The spec's names, Landing zone and contracts go in verbatim: a sibling builds against them. Scope's Out belongs to a sibling. Hidden dependency (can't finish until another ticket lands): find or post a bare idea for it, `gh issue edit <n> --add-blocked-by <m>`, comment why, `aisf_park`.
  - Render loop: render with the Visual rendering recipe in `project-testing`, once per state the leaf lists, in light and dark. PNGs go to `.aisf/images/`, named `<part>-<state>-light.png` and `<part>-<state>-dark.png`. Render, Read the PNG, compare it with its spot in `.aisf/render/<part>-mock.png` (the copy with that `data-theme` and that state's caption), adjust, render again. The mock PNG stays in `.aisf/render/`, never in `.aisf/images/`. Walk the leaf's checklist line by line: matches or doesn't. Tokens from `.aisf/design/tokens.css`, never literals; a colour with no token follows what the leaf decided. Stop when every line matches or has a stated reason it can't. Pixel-perfect is not the goal; an unresolved difference goes to the PR as a known deviation.
- Rework: the R4 work list is the scope. Change every item: behaviour by TDD, then re-render and replace the images in `.aisf/images/`. `.aisf/render/<part>-mock.png` from step 2 is reused: a rework runs in the same worktree, and the mock is never re-copied.
- Uses: `aisf:tdd`, `project-testing`, `aisf:github-issue`, `aisf_park`.
- Done: every behaviour has a passing test; every checklist line matches or has a stated reason. Rework: every item changed.
- Output: the PNGs in `.aisf/images/`; the per-line verdicts.
- Exits:
  - every behaviour built, every line checked → 4
  - the work needed lies outside Scope → escalate `spec`
  - hidden dependency, blocker linked → stop via `aisf_park`
  - a rework item contradicts the spec or needs a judgement call → escalate `spec`

### 4. Green

- Goal: `test` and `analyze` clean.
- Actions: run `test` and `analyze` from `project-toolchain`; read `analyze` as its block says. 5 fix attempts per failing check; a new failure resets the count. Unsure a failure is yours → run the file in a throwaway `git worktree` on `origin/main`. Red there too → not yours: report it, post a bare idea if none exists.
- Uses: `project-toolchain`.
- Done: both clean.
- Exits:
  - both clean, sent from 5 → 6
  - both clean, sent from 7 → 7
  - both clean, reached from 3 or R3 (first pass or rework) → 5
  - 5 fix attempts on a check → escalate `red`

### 5. Code review

- Goal: the architecture checked against the spec.
- Actions: launch one `aisf:review-code` agent whose prompt is the spec, verbatim, nothing else (on a one-PR ticket: the `## Spec` section). Fixed → nothing. Deviates from spec → each in the PR's Merge danger; a `contract` one also gets a comment on every sibling the spec names for it: old name and shape, new one, the rule. Re-run 4; keep its fixes.
- Uses: `aisf:review-code`.
- Done: its result handled, green.
- Exits:
  - the agent's fixes are applied → 4, then 6 (5 does not run again; no Output carries over or goes void)
  - the agent fixed nothing, or deviates and every deviation is in the PR's Merge danger, and green → 6
  - a deviation stays unresolved → escalate `spec`

### 6. Verify AC

- Goal: evidence for every criterion.
- Actions: behaviour → the passing test that asserts it, by name. Command → run it verbatim, show the output; never a test in its place. Visual → a per-line verdict as text, with the image file named. "Matches the mock" is not evidence; "16px padding, `var(--surface)`: matches; dark `--accent` reads heavier than the mock" is. The leaf has no `hitl`: the PR review is the human check. Rework: every work-list item gets one evidence line beside the criteria.
- Done: every criterion has evidence. Rework: every item has evidence.
- Output: the evidence for the PR.
- Exits:
  - every criterion has evidence → 7
  - a gap is fixable → 3, then 4 and 5 again (the tests and code stay; the PNGs, per-line verdicts and this step's evidence are void and made again)
  - a criterion is vague or unprovable → escalate `spec`

### 7. Simplicity review

- Goal: the diff simplified.
- Actions: invoke `aisf:review-simplicity` and handle its report as it says.
- Uses: `aisf:review-simplicity`.
- Done: no must-fix left.
- Exits:
  - the review applied a change, or a must-fix was fixed → 4, then 7 again (no other step runs again; no Output carries over or goes void)
  - no must-fix left → 8
  - a must-fix needs judgement → escalate `spec`

### 8. Commit

- Goal: one commit.
- Actions: invoke `aisf:commit`.
- Uses: `aisf:commit`.
- Done: committed.
- Exits:
  - committed, new build → 9
  - committed, rework → R5

### 9. PR

- Goal: the work shipped, the ticket findable.
- Actions: invoke `aisf:pr` with the step 6 evidence. Evidence names the mock path and each image file in `.aisf/images/`, says the images show on the ticket page, and gives the per-line verdict as text. Merge danger lists every unresolved difference from the mock, and why.
- Uses: `aisf:pr`.
- Done: PR open and ticket `in-review`.
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
  - the guard mismatches → stop

### R3. Rebase

- Goal: the current branch rebased on `origin/main`, `test` and `analyze` clean.
- Actions: `git status --porcelain`; non-empty → escalate `spec`, naming the dirty files. Else `git fetch origin`, `git rebase origin/main` on the current branch. Then run step 4 Green's actions.
- Uses: `git`, step 4 Green, `aisf_escalate`.
- Done: the branch is rebased and `test` and `analyze` are clean.
- Output: the rebased branch.
- Exits:
  - rebased, `test` and `analyze` clean → R4
  - dirty tree → escalate `spec`
  - rebase cannot finish → escalate `red`

### R4. Work list

- Goal: every review item listed; the list is the scope of this rework run.
- Actions: list each unresolved review thread (keep each comment's `databaseId`), each review body and PR conversation comment created after `--since` (none without `--since`), failing checks, conflicts. A rebase alone is no item.
- Uses: `gh api graphql` (`reviewThreads`), `gh pr view`, `gh pr checks`.
- Done: every item is on the list.
- Output: the work list.
- Exits:
  - work list written, items left → 3 (steps 4 to 8 run once more as in a first build; the work list stays as the scope, nothing goes void)
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
  - every handled item has a reply and review is re-requested → done

## Output

An open PR and the ticket `in-review`, the images in `.aisf/images/` and `.aisf/render/<part>-mock.png` (agent only, never committed); or a rework done: the PR updated in place (rebased, one rework commit, pushed with lease, body rewritten), no `approved` label, a reply per handled item with the rework SHA, review re-requested, the ticket `in-review`. Not rework: nothing written.
