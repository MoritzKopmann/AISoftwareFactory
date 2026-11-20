---
name: ui-implement-ticket
description: Build a ready type: ui leaf to a PR by render and compare, or rework its in-review PR.
disable-model-invocation: true
---

# ui-implement-ticket

## Role and goal

Build one ready `type: ui` leaf to an open PR by render and compare against its mock. An `in-review` ticket is reworked by steps R1–R7: every rework change passes the same gates as a first build (Code review, Fix bugs, Verify AC, Commit).

The oracle is the mock's PNG: render the mock once, render the build, look, compare picture with picture, adjust. TDD keeps behaviour, never geometry.

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
- Images are never committed or uploaded. `.aisf/` is gitignored: never `git add -f` an image.
- Rework: rebase, never merge `origin/main` in: a merge commit blocks the app's rebase-merge.
- Rework: a review thread is the reviewer's to resolve.
- Rework: one commit per rework run. Items stay uncommitted through 3 → 4 → 5 → 6; step 7 commits them once. Steps 4 and 5 read the uncommitted diff as in a first build.

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

- Goal: every behaviour built by TDD, every checklist line matching the mock PNG or carrying a stated reason, inside Scope, green.
- Actions:
  - Behaviour: TDD per `aisf:tdd`: what a click or key does, which state a view model describes for each input, callbacks, navigation. Assert behaviour only, never geometry: no padding, radius or colour equality, no counting wrapper elements. Test layout follows `project-testing`.
  - The spec's names, Landing zone and contracts go in verbatim: a sibling builds against them. Scope's Out belongs to a sibling. Hidden dependency (can't finish until another ticket lands): find or post a bare idea for it, `gh issue edit <n> --add-blocked-by <m>`, comment why, `aisf_park`.
  - Render loop: render with the Visual rendering recipe in `project-testing`, once per state the leaf lists, in light and dark. PNGs go to `.aisf/images/`, named `<part>-<state>-light.png` and `<part>-<state>-dark.png`. Render, Read the PNG, compare it with its spot in `.aisf/render/<part>-mock.png` (the copy with that `data-theme` and that state's caption), adjust, render again. The mock PNG stays in `.aisf/render/`, never in `.aisf/images/`. Walk the leaf's checklist line by line: matches or doesn't. Tokens from `.aisf/design/tokens.css`, never literals; a colour with no token follows what the leaf decided. Stop when every line matches or has a stated reason it can't. Pixel-perfect is not the goal; an unresolved difference goes to the PR as a known deviation.
- Rework: the R4 work list is the scope. Change every item: behaviour by TDD, then re-render and replace the images in `.aisf/images/`. `.aisf/render/<part>-mock.png` from step 2 is reused: a rework runs in the same worktree, and the mock is never re-copied.
- Uses: `aisf:tdd`, `project-testing`, `aisf:github-issue`, `aisf_park`.
- Done: every behaviour has a passing test; every checklist line matches or has a stated reason; green. Rework: every item changed.
- Output: the PNGs in `.aisf/images/`; the per-line verdicts.
- Exits:
  - every behaviour built, every line checked, green → 4
  - the work needed lies outside Scope → escalate `spec`
  - a rework item contradicts the spec or needs a judgement call → escalate `spec`
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
  - a deviation stays unresolved → escalate `spec`
  - 5 fix attempts on a check → escalate `red`

### 5. Fix bugs

- Goal: every line of the Suspected bugs and gaps list handled.
- Actions: per line:
  - **Behaviour bug**: write a failing test from its failure scenario, per `aisf:tdd`.
    - The test passes on today's code → delete the test, move on.
    - The fix would leave Scope or contradict the spec → `aisf_report_finding` (`kind` bug, `location` file:line, `summary`), one line in Merge danger, no fix.
    - Else fix it; the test passes.
  - **Visual bug** (geometry, colour, layout: no behaviour test allowed): fix it through step 3's render loop, re-render the affected states in light and dark, update that checklist line's verdict. The updated verdict is the proof. Evidence notes that no test was written for it. Out of Scope or against the spec → report it as a behaviour bug.
  - **Gap**: `aisf_report_finding` (`kind` gap), one line in Merge danger. No code.

  Then make it green. A fixed behaviour bug is not recorded in the PR body: its test in the diff is the record.

- Uses: `aisf:tdd`, `project-testing`, `aisf_report_finding`.
- Done: every line fixed, dropped or reported; green.
- Output: the Merge danger lines for reported bugs and gaps; updated verdicts and images for visual fixes.
- Exits:
  - every line handled, green → 6
  - 5 fix attempts on a check → escalate `red`

### 6. Verify AC

- Goal: evidence for every criterion.
- Actions: behaviour → the passing test that asserts it, by name. Command → run it verbatim, show the output; never a test in its place. Visual → a per-line verdict as text, with the image file named. "Matches the mock" is not evidence; "16px padding, `var(--surface)`: matches; dark `--accent` reads heavier than the mock" is. The leaf has no `hitl`: the PR review is the human check. Rework: every work-list item gets one evidence line beside the criteria.
- Done: every criterion has evidence. Rework: every item has evidence.
- Output: the evidence for the PR.
- Exits:
  - every criterion has evidence → 7
  - a gap is fixable → 3, then 4 and 6 again, and 5 when 4 lists bugs (the tests and code stay; the PNGs, per-line verdicts and this step's evidence are void and made again)
  - a criterion is vague or unprovable → escalate `spec`

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
- Actions: invoke `aisf:pr` with the step 6 evidence. Evidence names the mock path and each image file in `.aisf/images/`, says the images show on the ticket page, and gives the per-line verdict as text. Merge danger lists every unresolved difference from the mock, and why, and the lines from 4 and 5.
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

- Goal: the current branch rebased on `origin/main`, green.
- Actions: `git status --porcelain`; non-empty → escalate `spec`, naming the dirty files. Else `git fetch origin`, `git rebase origin/main` on the current branch. Then make it green (General rules).
- Uses: `git`, `project-toolchain`, `aisf_escalate`.
- Done: the branch is rebased; green.
- Output: the rebased branch.
- Exits:
  - rebased, green → R4
  - dirty tree → escalate `spec`
  - rebase cannot finish or 5 fix attempts on a check → escalate `red`

### R4. Work list

- Goal: every review item listed; the list is the scope of this rework run.
- Actions: list each unresolved review thread (keep each comment's `databaseId`), each review body and PR conversation comment created after `--since` (none without `--since`), failing checks, conflicts. A rebase alone is no item.
- Uses: `gh api graphql` (`reviewThreads`), `gh pr view`, `gh pr checks`.
- Done: every item is on the list.
- Output: the work list.
- Exits:
  - work list written, items left → 3, then 4, 6 and 7 again, and 5 when 4 lists bugs (one `aisf:review-code` launch per pass; the work list stays as the scope, nothing goes void)
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
