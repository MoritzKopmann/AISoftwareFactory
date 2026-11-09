---
name: github-issue
description: >
  Formats, posts and updates GitHub issues for the aisf workflow: create, edit an idea in
  place, post bare ideas and sub-issues, guarded status transitions, blocked-by, what each type, status and
  flag label means (waiting, stuck, hitl).
user-invocable: false
---

# GitHub Issue Skill

Callers decide _when_ to write to an issue. This skill owns _how_.

`gh` infers the repository from the current checkout. Never pass `-R`.

**Cold-read test:** a developer not in the original conversation can read the ticket
and start work without asking the author anything.

## Modes

| Mode                        | Writes                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Interview-driven create** | New issue, full anatomy, cold-read test, `type:`, `priority:`, `status: backlog` or `status: plan`                                                    |
| **Edit in place**           | Rewrites title and body, adds `type:`, `priority:` and `status: backlog` or `status: plan`. See _Edit an idea in place_.                              |
| **Bare idea**               | Minimal issue, no labels. See _Bare ideas_.                                                                                                           |
| **Sub-issue**               | Child of a parent: `status: ready`, `hitl` where confirmed; a UI child is an idea with `project-design`, else `status: backlog`. See _Relationships_. |
| **Split part**              | Child of a split umbrella: full anatomy, `status: plan`, parent's `type:` and `priority:`. See _Split part_.                                          |
| **Direct create**           | Full anatomy, cold-read test, labels as for interview-driven                                                                                          |

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

**A `## Design` section** may sit on an issue. `design` writes it: board URL, folder
`.aisf/artifacts/design/` in the `-authoring` worktree, accepted round, the what/why brief. Leave it
untouched when editing a body.

**A split part** (see _Split part_) is a full ticket body, not a spec. It carries the anatomy above.

**A sub-issue from `plan-ticket`** carries the body that skill hands over: a spec (Context ·
Scope · Landing zone · Acceptance criteria), or for a `type: ui` child what is displayed. Post it
as given.

## Metadata — all via labels

aisf writes only these label families. The app's label sync creates them when a project is
onboarded.

| Dimension | Values                                                                                                                                                  |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Type      | `type: bug` · `type: enhancement` · `type: task` · `type: spike` · `type: ui` · `type: onboard` · `type: skill`                                         |
| Priority  | `priority: critical` · `priority: high` · `priority: medium` · `priority: low`                                                                          |
| Status    | `status: backlog` · `status: plan` · `status: planned` · `status: ready` · `status: in-progress` · `status: in-review`                                  |
| Flag      | `hitl`: orthogonal to status. The leaf has one human checkpoint, named by its spec. The run works alone up to it, then waits.                           |
| Flag      | `waiting`: orthogonal to status. A run waits at its human checkpoint; the ticket keeps its status. `stuck`: a run gave up; the ticket keeps its status. |

Types:

- `type: bug`: something isn't working correctly.
- `type: enhancement`: new feature or improvement.
- `type: task`: non-feature work item.
- `type: spike`: research or investigation.
- `type: ui`: design-driven UI work.
- `type: onboard`: onboard the repo to aisf.
- `type: skill`: text written for agents: skills, agent definitions, commands, CLAUDE.md, memory-style files.

- Every **labelled** issue has exactly one `type:`, one `priority:` and one `status:`.
  Bare ideas have none.
- **Never create a label.** If `gh` reports a label as missing, the project isn't
  onboarded: stop and report "project not onboarded", naming the missing label.
- Write no other labels. Labels outside these families on an issue are left alone.

## Ticket states

An open issue with **no** `status:` label is an **idea**. Done is the closed state.

| State           | Stored as                                       |
| --------------- | ----------------------------------------------- |
| **idea**        | open, no `status:` label                        |
| **backlog**     | `status: backlog`                               |
| **plan**        | `status: plan`; may have an open spike child    |
| **planned**     | `status: planned`, has sub-issues               |
| **ready**       | `status: ready`, no sub-issues                  |
| **in-progress** | `status: in-progress`                           |
| **in-review**   | `status: in-review`, plus a PR with `Closes #N` |
| _(closed)_      | closed state; leftover labels are ignored       |

- Never `backlog → in-progress` — plan first.
- **`waiting` and `stuck` are labels beside the status, not statuses.** A ticket keeps its
  lifecycle status while it waits or is stuck. The app adds `waiting` (plus a comment with the
  request) when a run ends at its human checkpoint, and removes it on the answer. It adds
  `stuck` (plus a comment with the reason) and removes `waiting` when a run gives up. Reset
  removes both. A legacy `status: waiting` or `status: stuck` label is not migrated: the ticket
  shows as `conflict` until the label is removed by hand. The human answers on the ticket page, and the app resumes the run.
- A `planned` parent is a tracking umbrella: it is never implemented and never closed by hand.

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
     or the human may have moved the ticket (for example by adding the `stuck` or `waiting` label) mid-run; never overwrite that.
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

### Read back

After any `gh issue create` or `gh issue edit` that sets a body, check it landed. A length of
0 means stop and report.

```bash
gh issue view <n> --json body --jq '.body | length'
```

### Edit an idea in place

For `create-ticket` on an existing idea `#N`:

1. Guard: `#N` must have no `status:` label (`idea → backlog`, `idea → plan`, or `idea → idea`
   for `type: ui`). Otherwise stop and report its state.
2. Rewrite title and body from the interview; the body gets the full anatomy and passes the
   cold-read test. Open questions stay in the body. GitHub's edit history keeps the original idea text, so don't quote it back.
3. Never `hitl`. Write it in one edit:

   ```bash
   gh issue edit <n> --title "<title>" --body-file <tmp> \
     --add-label "type: <x>" --add-label "priority: <x>" --add-label "status: <backlog|plan>"
   ```

   A `type: ui` idea (`idea → idea`) gets no `status:` label; `design` moves it on:

   ```bash
   gh issue edit <n> --title "<title>" --body-file <tmp> \
     --add-label "type: ui" --add-label "priority: <x>"
   ```

### Bare ideas

For spin-offs and findings that a later create-ticket interview will refine:

- An outcome-phrased title.
- One or two lines of what and why.
- A provenance line: `Split from #N` (create-ticket spin-offs),
  `Found while implementing #N` (implement-ticket blockers and red-on-main findings) or
  `Found while onboarding #N` (onboard-project: accepted suggestions that need code changes).
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
  (not a split part) gets its own PR that closes it (`Closes #<sub>`).
- Each child (not a split part): full anatomy, cold-read test, `status: ready`, `hitl` where the human
  confirmed it. `type:` is per child (a spike is `type: spike`); `priority:` is inherited
  from the parent.
- **A `type: ui` child is never `ready`.** With `project-design` it is an idea (no `status:`
  label): its design run starts by itself. Without, it is `status: backlog` and waits for a design.
  Exception: leaves posted by `ui-ticket` under a designed `type: ui` ticket are `status: ready`.
- **A `type: skill` child posted by `plan-ticket` is `status: plan`**: `skill-ticket` plans it.
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

### Split part

For `plan-ticket`'s "Too big: split the ticket". Parts are full sub-issues under an
umbrella, each planned later on its own. They are not bare ideas, and not `ready` specs.

- Body: full anatomy, cold-read test. No `Split from #N`, no `Part of #N`: the native parent
  link is the record.
- Labels: the umbrella's `type:` and `priority:`, and `status: plan`.
- `--parent <n>`, and `--blocked-by` between parts where one needs another. Create in
  dependency order.
- The umbrella's body stays unchanged. After all parts: the `subIssuesSummary.total` check,
  then guard `plan → planned` on the umbrella.

  ```bash
  gh issue create --title "<title>" --body-file <tmp> \
    --parent <n> --blocked-by <a>,<b> \
    --label "type: <umbrella's>" --label "priority: <umbrella's>" --label "status: plan"
  ```

## Comments

For reason and gap notes (a vague spec sent back to idea, a stuck reason, a park or blocker
note), write the text to a temp file, then:

```bash
gh issue comment <n> --body-file <tmp>
```

## The app died mid-answer

The ticket is left with the `stuck` label, or `in-progress` with no active run. The hand fix: press Reset to
ready on the ticket page, then Run.
