---
name: github-issue
description: >
  Formats, posts and updates GitHub issues for the aisf workflow: create, edit an idea in
  place, post bare ideas and sub-issues, guarded status transitions, blocked-by. Called by
  create-, plan- and implement-ticket.
user-invocable: false
---

# GitHub Issue Skill

Callers decide _when_ to write to an issue. This skill owns _how_.

`gh` infers the repository from the current checkout. Never pass `-R`.

**Cold-read test:** a developer not in the original conversation can read the ticket
and start work without asking the author anything.

## Modes

| Mode                        | Caller                                                           | Writes                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Interview-driven create** | `aisf:create-ticket`, hand run with no issue number              | New issue, full anatomy, cold-read test, `type:`, `priority:`, `status: backlog` or `status: plan`                       |
| **Edit in place**           | `aisf:create-ticket` on `#N`                                     | Rewrites title and body, adds `type:`, `priority:` and `status: backlog` or `status: plan`. See _Edit an idea in place_. |
| **Bare idea**               | `aisf:create-ticket` spin-offs, `aisf:implement-ticket` findings | Minimal issue, no labels. See _Bare ideas_.                                                                              |
| **Sub-issue**               | `aisf:plan-ticket`                                               | Child of a parent: `status: ready`, `hitl` where confirmed; a UI child is `status: backlog`. See _Relationships_.        |
| **Direct create**           | any automation caller with a fully-formed finding                | Full anatomy, cold-read test, labels as for interview-driven                                                             |

## Anatomy of a good ticket

Scale detail to the work — a dependency bump needs no Given/When/Then.

**Title** — outcome or problem, not implementation; scannable in a backlog of fifty.

- Bug: ✓ "Traveled path disappears when zoomed past level 8" ✗ "Fix map bug"
- Feature: ✓ "Users can export a trip as a printable postcard" ✗ "Add export feature"
- Three "and"s → probably several tickets.

**Context** — one or two sentences: why this matters, answers "why?" months later.

**Scope** — what's in and explicitly what's **out**. Stated non-goals prevent creep.

**Acceptance criteria** — "done" in observable, testable terms; Given/When/Then where
it fits. Checkable: ✓ "completes in under 2s for 95% of requests" ✗ "works better".

**Reproduction (bugs only)** — numbered steps, expected vs actual, environment.

**Supporting material** — screenshots, design links, related tickets (`Related: #N`),
pasted error text (paste it, don't describe it — it's searchable).

**A sub-issue from `aisf:plan-ticket`** carries the body that skill hands over: a spec (Context ·
Scope · Landing zone · Acceptance criteria), or for a `type: ui` child what is displayed. Post it
as given.

## Metadata — all via labels

aisf writes only these label families. The app's label sync creates them when a project is
onboarded.

| Dimension | Values                                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Type      | `type: bug` · `type: enhancement` · `type: task` · `type: spike` · `type: ui`                                                                                |
| Priority  | `priority: critical` · `priority: high` · `priority: medium` · `priority: low`                                                                               |
| Status    | `status: backlog` · `status: plan` · `status: planned` · `status: ready` · `status: in-progress` · `status: waiting` · `status: in-review` · `status: stuck` |
| Flag      | `hitl`: orthogonal to status. The leaf has one human checkpoint, named by its spec. The run works alone up to it, then waits.                                |

- Every **labelled** issue has exactly one `type:`, one `priority:` and one `status:`.
  Bare ideas have none.
- **Never create a label.** If `gh` reports a label as missing, the project isn't
  onboarded: stop and report "project not onboarded", naming the missing label.
- Write no other labels. Labels outside these families on an issue are left alone.

## Ticket states

An open issue with **no** `status:` label is an **idea**. Done is the closed state.

| State           | Stored as                                          | Written by                                                                                                                                                                                                                              |
| --------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **idea**        | open, no `status:` label                           | anyone opening an issue; `aisf:plan-ticket` sends a vague spec back (`plan → idea`)                                                                                                                                                     |
| **backlog**     | `status: backlog`                                  | `aisf:create-ticket` (`idea → backlog`); `aisf:plan-ticket` for UI work awaiting a design (`plan → backlog`, and a new `type: ui` child)                                                                                                |
| **plan**        | `status: plan`; may have an open spike child       | `aisf:create-ticket` (`idea → plan`); the human (`backlog → plan`, `stuck → plan`)                                                                                                                                                      |
| **planned**     | `status: planned`, has sub-issues                  | `aisf:plan-ticket` (`plan → planned`)                                                                                                                                                                                                   |
| **ready**       | `status: ready`, no sub-issues                     | `aisf:plan-ticket` (`plan → ready`, and new sub-issues); the human (`stuck → ready`); the app's Reset to ready (from `stuck` or `in-progress`)                                                                                          |
| **in-progress** | `status: in-progress`                              | `aisf:implement-ticket` (`ready → in-progress`, and `in-review → in-progress` for rework); the app (`stuck → in-progress` on a permission answer, `waiting → in-progress` on a checkpoint answer)                                       |
| **waiting**     | `status: waiting`, plus a comment with the request | the app (a run that ends at its human checkpoint)                                                                                                                                                                                       |
| **in-review**   | `status: in-review`, plus a PR with `Closes #N`    | `aisf:implement-ticket` (`in-progress → in-review`)                                                                                                                                                                                     |
| **stuck**       | `status: stuck`, plus a comment with the reason    | the app (`→ stuck` when a run gives up); by hand, the _Hand-run stuck_ operation                                                                                                                                                        |
| _(closed)_      | closed state; leftover labels are ignored          | the app: it rebase-merges an approved PR, and `Closes #N` closes the ticket; it also closes a `planned` parent when its last child closes; `aisf:implement-ticket` closes a `hitl` leaf with no code change, after its evidence comment |

- Never `backlog → in-progress` — plan first.
- A `planned` parent is a tracking umbrella: it is never implemented and never closed by hand.
- **A spike has no PR.** `aisf:spike` moves it `ready → in-progress` and closes it itself, once
  its verdict is in the parent's body.

## Guarded transitions

Every status change is a guarded swap. The caller passes `<expected-from> → <to>`, where
`idea` means "no `status:` label".

1. Read the current labels:

   ```bash
   gh issue view <n> --json labels --jq '[.labels[].name | select(startswith("status:"))]'
   ```

2. Compare with the expected state:
   - **Match** (for `idea`: the list is empty) → go on.
   - **Mismatch** → stop. Report the actual state to the caller and write nothing. The app
     or the human may have moved the ticket (for example to `stuck` or `waiting`) mid-run; never overwrite that.
3. Swap in one edit. Remove every `status:` label found in step 1 and add the new one, so
   exactly one remains:

   ```bash
   gh issue edit <n> --remove-label "status: <old>" --add-label "status: <new>"
   ```

   For `→ idea` (a vague spec going back), only remove. Pass one `--remove-label` per stray
   `status:` label too.

Note the space after each label colon (`status: ready`).

## Posting

Compose the body, write it to a temp file (multi-line bodies can't go inline), then:

```bash
gh issue create \
  --title "<title>" --body-file <tmp> \
  --label "type: <x>" --label "priority: <x>" --label "status: <backlog|plan>"
```

It prints the new issue URL on stdout.

### Edit an idea in place

For `aisf:create-ticket` on an existing idea `#N`:

1. Guard: `#N` must have no `status:` label (`idea → backlog` or `idea → plan`). Otherwise
   stop and report its state.
2. Rewrite title and body from the interview; the body gets the full anatomy and passes the
   cold-read test. GitHub's edit history keeps the original idea text, so don't quote it back.
3. Write it in one edit:

   ```bash
   gh issue edit <n> --title "<title>" --body-file <tmp> \
     --add-label "type: <x>" --add-label "priority: <x>" --add-label "status: <backlog|plan>"
   ```

### Bare ideas

For spin-offs and findings that a later create-ticket interview will refine:

- An outcome-phrased title.
- One or two lines of what and why.
- A provenance line: `Split from #N` (create-ticket spin-offs) or
  `Found while implementing #N` (implement-ticket blockers and red-on-main findings).
- **No labels.** The cold-read test is waived.

```bash
gh issue create --title "<title>" --body-file <tmp>
```

## Relationships

Every relationship is a native GitHub link, set with `gh` flags. Never write `Part of #N` or
`Depends on #N` into a body: the native links are the only record. `Related: #N` stays as
body text, because it isn't a dependency.

| Need                         | Command                                     |
| ---------------------------- | ------------------------------------------- |
| New sub-issue of `<p>`       | `gh issue create … --parent <p>`            |
| New issue blocked by others  | `gh issue create … --blocked-by <a>,<b>`    |
| Existing issue gets blocker  | `gh issue edit <n> --add-blocked-by <m>`    |
| Remove a blocker             | `gh issue edit <n> --remove-blocked-by <m>` |
| Attach an existing sub-issue | `gh issue edit <p> --add-sub-issue <n>`     |

### Sub-issues

- Split when work spans independent areas, each completable in one session. Each sub-issue
  gets its own PR that closes it (`Closes #<sub>`).
- Each child: full anatomy, cold-read test, `status: ready`, `hitl` where the human
  confirmed it. `type:` is per child (a spike is `type: spike`); `priority:` is inherited
  from the parent.
- **A `type: ui` child is `status: backlog`**, not `ready`: it waits for a design and is built
  through the design path.
- **A spike child leaves its parent at `status: plan`**: planning resumes on its verdict.

  ```bash
  gh issue create --title "<title>" --body-file <tmp> \
    --parent <p> --blocked-by <a>,<b> \
    --label "type: <x>" --label "priority: <parent's>" --label "status: ready"
  ```

- **Create children in dependency order**: `--blocked-by` needs the blocker's number.
- The parent is a **tracking umbrella**: no branch, no PR, `status: planned`
  (`plan → planned`, guarded). A one-subtask split has no umbrella: the ticket itself goes
  `plan → ready`.
- A failed link is easy to miss. After creating the children, check the parent's count
  matches:

  ```bash
  gh issue view <p> --json subIssuesSummary --jq .subIssuesSummary.total
  ```

## Comments

For reason and gap notes (a vague spec sent back to idea, a stuck reason, a park or blocker
note), write the text to a temp file, then:

```bash
gh issue comment <n> --body-file <tmp>
```

## The app died mid-answer

The ticket is left `stuck`, or `in-progress` with no active run. The hand fix: press Reset to
ready on the ticket page, then Run.

## Hand-run stuck

The fallback when a run must give up and the app's `aisf_escalate` tool is absent:

1. Guarded transition `<current> → stuck` (usually `in-progress → stuck`).
2. A comment stating the reason: what was tried, what failed (paste the output), and what a
   human needs to decide.
