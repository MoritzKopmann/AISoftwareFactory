---
name: ui-implement-ticket
description: >
  Drive a ready type: ui leaf to a PR by render and compare: build against the mock in
  .aisf/design/mocks, render with the project's own recipe, look at the PNG, adjust, and leave
  the images in .aisf/images for the ticket page. Test behaviour with TDD, never geometry. Also
  resumes an in-progress leaf and reworks an in-review one. Use when the user wants to
  implement a UI leaf. Triggers: "implement the ui ticket #N", "build component #N".
---

# ui-implement-ticket

Drive a `type: ui` leaf to a PR. Argument: `<n> [--since <ISO time>]`. `<n>` is the ticket
number; if none, ask. `--since` is when the app's last run ended; only rework uses it.

**Why this is separate from `aisf:implement-ticket`:** TDD has no grip on geometry. A criterion
like `16px padding` becomes `expect(padding).toBe('16px')`: the code restated in a test. The
oracle for visual work is the mock, so the loop is **render, look, compare, adjust**. TDD keeps
the job it is good at: behaviour.

**This skill follows `aisf:implement-ticket` for everything not visual.** Read it and apply
these sections as written there: Guard rails, Stop points (mode: AFK when `aisf_escalate` is
present, hand-run otherwise), §1 Identify (parent, blocked, in-review and rework with
`aisf:implement-ticket`'s `rework.md`), §3 Claim and branch, §5 Green, §6 Code review, §8 Simplicity review, §9 Commit and §10 PR. It
never merges. The sections below replace §0, §2, §4 and §7.

`gh` infers the repository from the checkout. Never pass `-R`. Every status change and issue
write goes through `aisf:github-issue`.

## 0. Precondition

```bash
gh issue view <n> --json title,body,labels,state,parent,subIssues,blockedBy
```

1. A leaf with `type: ui`, `status: ready` (new), `in-progress` (resume) or `in-review`
   (rework). Without `type: ui` → stop, name `aisf:implement-ticket`, write nothing. A
   `planned` parent → §1 of `aisf:implement-ticket`. The `waiting` label → stop.
2. `project-design` loads. `Unknown skill` → escalate `spec`, naming `project-design`.
3. `project-testing` has `## Visual rendering`. Missing → escalate `spec`, naming
   `## Visual rendering`.
4. `.aisf/design/mocks/<part>.html` exists in this worktree, with `<part>` named in the leaf
   body. Missing → escalate `spec`, naming `.aisf/design/` or the mock path.

Every failure of 2 to 4 happens **before the claim**. Escalate `spec` in AFK; in hand-run, say
what is missing and ask. Then load `project-toolchain` (`Unknown skill` → stop: "project not onboarded"). It gives
`format`, `analyze`, `test`, `test_file`.

Say `<n>` and the mode (new / resume / rework, AFK / hand-run).

## 2. Understand

- Read the leaf body and the mock `.aisf/design/mocks/<part>.html`. It is what you build
  against. Read `.aisf/design/tokens.css`.
- Load `aisf:tdd`, `project-design` and `project-testing`, plus each skill they name under
  `## Load also`. Never `project-architecture`: `aisf:review-code` checks it (Guard rails).
- List the files, the states, the behaviours and which test proves each. No code first.

If the leaf replaces a component, deleting it is part of the job.

## 3. Claim and branch

As `aisf:implement-ticket` §3: guarded `ready → in-progress` first (resume: nothing; rework:
per `aisf:implement-ticket`'s `rework.md`), then the branch.

## 4. Build

### Behaviour, with TDD

Per `aisf:tdd`, one behaviour per Red-Green-Refactor cycle: what a click or key does, which
state a view model describes for each input, callbacks, navigation. **Never assert geometry**:
no padding, radius or colour equality, no counting wrapper elements. Test layout follows
`project-testing`.

**Stay inside Scope.** What the leaf lists under **Out** belongs to a sibling. A hidden
dependency, or needed work outside Scope: as `aisf:implement-ticket` §4 (park, or escalate
`spec`).

### Render loop

Render with the `## Visual rendering` recipe in `project-testing`, once per state the leaf
lists, in light and dark. Write the PNGs to `.aisf/images/` in this worktree, named
`<part>-<state>-light.png` and `<part>-<state>-dark.png`.

**Render, Read the PNG, compare it with the mock, adjust, render again.** Then walk the leaf's
checklist line by line and decide per line: matches or doesn't. A line not checked is a line
not built.

Use tokens from `.aisf/design/tokens.css`, never literals. A colour with no token: follow what
the leaf decided.

**Stop when every line matches or has a stated reason it can't.** Pixel-perfect is not the
goal. An unresolved difference goes to the PR as a known deviation. Swallowing it is the only
wrong move.

Images are never committed or uploaded. `.aisf/` is gitignored: never `git add -f` an image.

## 5. Green

As `aisf:implement-ticket` §5.

## 6. Code review

As `aisf:implement-ticket` §6. The prompt is the leaf's spec, verbatim.

## 7. Verify AC

Every criterion gets evidence:

- **Behaviour** → the passing test that asserts it, by name.
- **A command** → run it verbatim, show the output.
- **Visual** → a per-line verdict as text, with the image file named.
  "Matches the mock" is not evidence. "16px padding, `var(--surface)`: matches; dark `--accent`
  reads heavier than the mock" is.

A fixable gap → back to §4. A vague or unprovable criterion → escalate `spec`. The leaf has no `hitl` and no
`aisf_checkpoint`: the PR review is the human check. No Artifact tool call is made.

## 8. to 10.

§8 Simplicity review, §9 Commit and §10 PR as `aisf:implement-ticket`. PR Evidence:

- Names the mock path and each image file in `.aisf/images/`, and says the images show on the
  ticket page.
- Gives the per-line verdict as text.
- Merge danger lists every unresolved difference from the mock, and why.
- No image is uploaded or committed.

Rework (`--since`) re-renders and replaces the images.
