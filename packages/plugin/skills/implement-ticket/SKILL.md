---
name: implement-ticket
description: >
  Drive a ready GitHub leaf ticket end-to-end to a PR: branch, implement via TDD, get the
  project's checks green, verify acceptance criteria, review for simplicity, commit, update
  ticket state, open the PR. Also resumes an in-progress ticket and reworks an in-review one
  whose PR has changes requested. Given a planned parent, lists its ready children and stops.
  Use when the user wants to implement/build/work on a ticket or issue.
  Triggers: "implement #N", "work on ticket N", "build issue N", "start on #N".
---

# implement-ticket

Drive a ready leaf to a PR. Argument: ticket number. If none, ask.

`gh` infers the repository from the current checkout. Never pass `-R`. Every status change
and every issue write goes through `aisf:github-issue`.

## 0. Precondition

**Project slots.** Load `project-toolchain`, `project-architecture` and `project-testing` with
the Skill tool (bare names). If any returns `Unknown skill`, stop and report "project not
onboarded". Do not improvise commands, placement or test rules. `format`, `analyze`, `test`
and `test_file` below always mean the commands in the `aisf-toolchain` block of
`project-toolchain`.

**Status.** Read the ticket:

```bash
gh issue view <n> --json title,body,labels,state,parent,subIssues,blockedBy
```

| `status:`     | What it means                                                  | Go on as |
| ------------- | -------------------------------------------------------------- | -------- |
| `ready`       | a leaf that may be implemented now                             | new run  |
| `in-progress` | an earlier run crashed or paused; resume it                    | resume   |
| `in-review`   | rework, if §1 finds the PR needs it; otherwise stop and say so | rework   |
| `planned`     | a parent: list its ready children (§1) and stop                | —        |
| `backlog`     | needs `aisf:create-ticket` → `plan`, then `aisf:plan-ticket`   | stop     |
| `plan`        | needs `aisf:plan-ticket`                                       | stop     |
| `stuck`       | needs the human: Retry or Start over, or move it back by hand  | stop     |
| none / closed | an idea needs `aisf:create-ticket`; a closed ticket is done    | stop     |

A stop here names the stage the ticket needs and writes nothing.

**Mode.** Decide once, now, and keep it for the whole run:

- **AFK** when the `aisf_escalate` tool is present **and** the ticket has no `hitl` label.
  No human is watching.
- **HITL** otherwise: a `hitl` app run, or a hand run. A human is present in chat.

## Stop points

Wherever a step below says **escalate** or **park**, act by mode:

| Stop point                                                                          | AFK                                                   | HITL                                    |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------- |
| **escalate `red`**: a check is still failing (§5)                                   | `aisf_escalate({kind: 'red', reason})`                | show the failing output and ask in chat |
| **escalate `spec`**: a question the ticket doesn't answer                           | `aisf_escalate({kind: 'spec', reason})`               | ask the concrete question in chat       |
| **escalate `denied`**: the policy hook denied the same kind of action about 3 times | `aisf_escalate({kind: 'denied', reason})`             | say what was denied and ask in chat     |
| **park**: a hidden dependency on another ticket (§4)                                | set the blocker, comment, then `aisf_park({blocker})` | say so in chat and propose the blocker  |

- In AFK the run **ends** at the tool call. The `reason` holds what was tried, what failed
  (paste output), and the concrete question or decision a human needs to make.
- In HITL the run carries on with the human's answer. Record what they decided as evidence
  (§6) or under `## Decisions made` (§9).
- Never call an `aisf_*` tool that isn't present. If the human in chat says to give up, use
  `aisf:github-issue` _Hand-run stuck_ with the same reason text.
- Small, reversible choices the ticket leaves open are not stop points: make them and list
  them under `## Decisions made`.

## 1. Identify

**Parent given.** The ticket has sub-issues (`status: planned`). Parents are never
implemented. List the children that are `status: ready` and have no open blocker:

```bash
gh issue view <n> --json subIssues --jq '.subIssues.nodes[] | select(.state=="OPEN") | .number'
gh issue view <child> --json title,labels,blockedBy
```

Report them, one line each (`#<child>` title, `hitl` if set), in the order GitHub returns
them. **Don't pick one.** Stop. The app closes finished parents; this skill never does.

**Blocked.** `blockedBy` lists an open issue → stop and name it. Don't park: the app never
starts a blocked ticket, so an open blocker only happens by hand.

**Rework.** For `status: in-review`, find the PR that closes the ticket:

```bash
gh issue view <n> --json closedByPullRequestsReferences --jq '.closedByPullRequestsReferences[].number'
gh pr view <pr> --json reviewDecision,mergeable,statusCheckRollup,reviews,headRefName,url
```

- `reviewDecision` is `CHANGES_REQUESTED`, or checks are failing, or `mergeable` is
  `CONFLICTING` → **rework mode**. Its work list is §4's.
- Otherwise the PR is waiting on review → stop and say so.

Name `<n>` and the mode (new / resume / rework, AFK / HITL) before touching a file.

## 2. Understand

- Read the ticket. If it has a `parent`, read the parent's Dev Notes too, for the plan and
  flow. No parent → the Dev Notes are on the ticket itself.
- Load `aisf:tdd`. `project-architecture` and `project-testing` are loaded; also load every
  skill each names under `## Load also`.
- If a `project-index` skill exists, invoke its recall for each module the ticket touches.
  Skip silently if it returns `Unknown skill`.
- From the AC, list: files to touch, behaviors, and the proof for each AC. No code until
  this list exists.
- A criterion that is vague or unprovable as written → **escalate `spec`** now, not after
  the code is written.

## 3. Branch

Target: `aisf/<n>-<kebab title>`.

**Already on `aisf/<n>-*`** → stay. In an app run the Runner has already created this
worktree on the branch. Uncommitted work there belongs to this ticket (a resumed run): keep
it.

**Otherwise** (a hand run) the tree must be clean first: `git status --porcelain`.

- Empty, new run → `git fetch origin && git switch -c aisf/<n>-<kebab title> origin/main`.
  Never `checkout main`: the primary checkout holds it, and in a worktree that fails.
- Empty, rework or resume with a pushed branch → `git fetch origin && git switch <branch>`
  (the PR's `headRefName`).
- Non-empty → ask the human in chat: commit it, stash it, or drop it. **Never stash**,
  discard or carry changes across branches on your own. The stash is shared across worktrees.

Then write the status with `aisf:github-issue` (guarded):

- New run: `ready → in-progress`.
- Rework: `in-review → in-progress`.
- Resume: already `in-progress`, nothing to write.

A guard mismatch (the app or the human moved the ticket, e.g. to `stuck`) → stop, report
the actual state, write nothing.

**Rework with conflicts:** `git fetch origin && git rebase origin/main`, resolve each step,
and re-run §5. Never merge `origin/main` into the branch: a merge commit makes the PR
non-rebaseable, and the app rebase-merges. The rebase rewrites the branch, so §9 pushes it
with `--force-with-lease`, and replies quote the new commit SHAs.

## 4. Implement

Strict TDD per `aisf:tdd`: one behavior per Red-Green-Refactor cycle. Code and tests follow
`project-testing`; placement follows `project-architecture`. Cover every AC behavior.

**Stay inside Scope.** What the ticket lists under **Out** belongs to a sibling: leaving it
alone is the job, not an omission. A sibling's file edited here is a conflict in their PR.
Work the ticket needs but Scope excludes → **escalate `spec`**. Do not annex it.

**Hidden dependency.** The ticket can't be finished until another ticket lands.

- AFK: through `aisf:github-issue`, find the blocking ticket or post a bare idea for it
  (`Found while implementing #<n>`), add it as a native blocker
  (`gh issue edit <n> --add-blocked-by <m>`), and comment on `<n>` why. Then **park**.
- HITL: say so in chat, naming the ticket that should block this one. Don't write anything
  until the human agrees.

Leave the code slightly better than you found it, bounded: files you already touch for this
ticket, cleanups that keep every test green. Anything bigger is a ticket, not a detour.

**Rework.** The review is the work list: each unresolved review thread on the PR, plus the
body of each review that requested changes, plus failing checks and conflicts. Fetch the
threads with:

```bash
gh api graphql -F owner='{owner}' -F repo='{repo}' -F pr=<pr> -f query='
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) { pullRequest(number: $pr) {
      reviewThreads(first: 100) { nodes { isResolved comments(first: 50) {
        nodes { databaseId author { login } path line body } } } } } } }'
```

Handle each item as a normal TDD change. A comment that contradicts the AC or the Dev Notes,
or that needs a judgement call → **escalate `spec`**. Keep a list of item → commit for §9.

## 5. Green

`test` and `analyze`, both clean. Read `analyze` output as the prose under the
`aisf-toolchain` block describes.

- **Never weaken a test to get green**: no deleted assertion, loosened matcher, skipped
  test, or expectation rewritten to match the bug. The test is the ticket; the code is what
  moves.
- **Failures you did not cause aren't yours.** Unsure → check the file on a clean base,
  never with `git stash`:

  ```bash
  git fetch origin && git worktree add <tmp>/base origin/main
  # run test_file for <file> inside <tmp>/base
  git worktree remove --force <tmp>/base
  ```

  Red on main too → leave it, say so in the report, and if no issue exists for it post a
  bare idea through `aisf:github-issue` (`Found while implementing #<n>`).

- Smells in files you already touched: fix them. Elsewhere: report, don't fix.
- **Fix attempts: 5 per failing check** (test, lint or build). An attempt is one change
  followed by a re-run. A new, different failure resets the count. Still failing after 5 →
  **escalate `red`** with the failing output.
- **Never push, and never open or update a PR, while red.**

## 6. Verify AC

Walk the AC list top to bottom. Every criterion gets evidence, by kind:

- **Behavioral** ("Given… when… then…") → the passing test that asserts it, named.
- **A command** (`grep -r … returns nothing`, `analyze` clean) → run it verbatim, show the
  output. Not a test: do not substitute one, and do not call it done unrun.
- **A human check** (on-device or visual) on a `hitl` leaf → ask in chat, and record the
  human's answer as the evidence.
- **Neither**, vague or unprovable as written → **escalate `spec`**. Never quietly rate it
  green.

Any gap → back to §4. In rework, every work-list item also gets its evidence here.

## 7. Simplicity review

Invoke `aisf:review-simplicity` on the working diff. It applies simplicity fixes on its own
and reports what it applied, discarded, and any architecture breaches and bugs/gaps.

- Re-run `test` and `analyze`. Both must stay clean (§5's rules and attempt count apply).
- **Architecture (must-fix)**: fix each, re-run §5, then run `aisf:review-simplicity`
  again. A fix that needs a judgement call → **escalate `spec`**.
- **Bugs/gaps** it lists go in the PR body under `## Known bugs` (§9). Don't fix them here.

## 8. Commit

Invoke `aisf:commit`. The branch is `aisf/<n>-*`, so it adds `refs #<n>` itself, and it
refreshes `project-index` when that slot exists. A PR may have several commits; the app
squash-merges them.

`<n>` is this leaf, never its parent. Wrong number in the trailer → amend before pushing.

## 9. PR

`git push -u origin HEAD`. After a rebase (§3) use `git push --force-with-lease` instead. Never
push to the default branch, never force-push in any other case, and never use plain `--force`.

`gh pr view --json url -q .url` succeeds → the PR already exists (a resumed run or rework).
Reuse it, skip creation.

### New PR

Find the base: `gh repo view --json defaultBranchRef -q .defaultBranchRef.name`. Write the
body to `<tmp>`, then:

```bash
gh pr create --base <default> --title "<type>(<scope>): <ticket title>" --body-file <tmp>
```

No `--head` (`gh` takes the current branch) and no `--draft`: the PR opens ready for review.
The title is a conventional-commit subject, with `<type>` and `<scope>` as `aisf:commit`
chose them, because the squash commit on the default branch takes it. Body:

    ## Summary
    What changed and why. Two or three lines.

    ## Acceptance criteria
    - [x] One line per criterion from §6: the criterion, `—`, its evidence (the test name,
      the command and what it printed, or the human's answer).

    ## Decisions made
    The small, reversible choices the ticket left open, and every untestable-change skip
    from `aisf:tdd` with the proof used. Omit the section if there are none.

    ## Known bugs
    The bugs/gaps from §7. Omit the section if there are none.

    Closes #<n>

Every box ticked: an unticked box means §6 isn't done.

Verify the base took: `gh pr view --json baseRefName -q .baseRefName` → the default branch.
Anything else, fix it with `gh pr edit --base <default>` before reporting.

Write `in-progress → in-review` with `aisf:github-issue`. **Never skip this: it is what
makes the ticket findable.**

### Rework

After the push, no new PR:

1. **Reply under each review comment** with what changed and the commit SHA:

   ```bash
   gh api repos/{owner}/{repo}/pulls/<pr>/comments/<databaseId>/replies -f body='<reply>'
   ```

   A review body (not an inline thread) gets one PR comment quoting it:
   `gh pr comment <pr> --body-file <tmp>`.

2. **Never resolve a thread.** Whether the fix is good is the reviewer's call.
3. Re-request review from each reviewer who requested changes:

   ```bash
   gh api -X POST repos/{owner}/{repo}/pulls/<pr>/requested_reviewers -f 'reviewers[]=<login>'
   ```

4. Update the PR body if an AC's evidence or `## Decisions made` changed.
5. Write `in-progress → in-review` with `aisf:github-issue`.

### Report

The PR URL, plus one line each confirming §5–9: `test` and `analyze` clean, every AC
evidenced, the simplicity review outcome, commit trailer `refs #<n>`, PR base the default
branch, label `status: in-review`, and in rework every comment replied to and review
re-requested. A line you cannot write is a step you have not finished: go back and finish it.
Then stop.

**Never merge.** When a human approves the PR, the app squash-merges it and `Closes #<n>`
closes the ticket. No run merges, enables auto-merge, or closes the ticket itself.
