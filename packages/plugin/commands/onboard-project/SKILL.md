---
name: onboard-project
disable-model-invocation: true
description: Draft a project's slots with the owner and deliver them as one PR.
---

# onboard-project

## Role and goal

Draft the project's slots with the owner and deliver them as one PR. Merging it is the approval.

## Parameters

`<n>`: the onboarding issue.

## General rules

- Every issue read and write goes through `aisf:github-issue`.
- The project has no slots yet. **Never call a skill that loads a project slot**
  (`aisf:commit`, `aisf:tdd`, `aisf:review-*`): they stop with "project not onboarded". Commit
  with `git` directly.

## 1. Read

Read the issue (title, body, labels, state) through `aisf:github-issue`.

- `status: ready` → guarded `ready → in-progress`, before any file work.
- `status: in-progress` → resume, no guard.
- Other type or state, or a guard mismatch → stop: name the state, write nothing.

Done: the issue is `type: onboard` and `in-progress`.
Exits: claimed or resumed → 2 · other type or state, or guard mismatch → stop.

## 2. Ledger

State lives in `.aisf/artifacts/onboard-<n>/` (gitignored):

- `ledger.json`: `{ "<slot>": { "<section>": "confirmed" | "edited" | "open" } }`
- `drafts/<slot>/…`: the draft files as last shown.

**Read both first.** A section marked `confirmed` or `edited` is never asked again. Update the
ledger right after each answer, before the next step.

Done: ledger and drafts read, or known absent (new run).
Exits: ledger read → 3.

## 3. Gather, per slot

Sources, in this order:

1. **Migrate** existing docs: `CLAUDE.md`, `README`, `.claude/commands/*`, `.claude/skills/*`.
2. **Scan** the repo: manifests, CI, scripts, tree, tests.
3. **Ask** for unwritten knowledge, per slot.
4. **Suggest** missing best practices from stack knowledge. Suggestions only: never put one in
   a slot unconfirmed.

A repo with no docs runs the same flow. Step 1 finds nothing, so the interview leads: ask for
each slot instead of migrating.

Old project copies of skills (for example `.claude/skills/project-*`, `code-rules`, or copies of
plugin skills) are sources: mine them. Propose deleting each in the PR, per file. The owner may
keep any. Project-only skills stay and are wired in through the slot's `## Load also`.

Each section is shaped by `references/shape-<slot>.md`. Shapes are structure only. The content
comes from the sources above.

| Slot                   | Shape                                      | File written                                                           |
| ---------------------- | ------------------------------------------ | ---------------------------------------------------------------------- |
| `project-toolchain`    | `references/shape-project-toolchain.md`    | `.claude/skills/project-toolchain/SKILL.md`                            |
| `project-testing`      | `references/shape-project-testing.md`      | `.claude/skills/project-testing/SKILL.md`                              |
| `project-architecture` | `references/shape-project-architecture.md` | `.claude/skills/project-architecture/SKILL.md` + `references/rules.md` |
| `code-rules`           | `references/shape-code-rules.md`           | `.claude/skills/code-rules/SKILL.md`                                   |

`project-design` is optional. Ask the owner first, as the page's first question: does the
project have a frontend? Cards `yes` and `no`, ledger section `project-design.frontend`.

- `yes` → draft the slot below, shaped by `references/shape-project-design.md`. Also draft the
  optional `## Visual rendering` section of `project-testing`, shaped by
  `references/shape-project-testing.md`. It shows on the review page with that slot.
- `no` → write no `project-design` slot and no `## Visual rendering` section. Never ask about
  it again.

| Slot             | Shape                                | File written                             |
| ---------------- | ------------------------------------ | ---------------------------------------- |
| `project-design` | `references/shape-project-design.md` | `.claude/skills/project-design/SKILL.md` |

Its presence marks the project as having a frontend. Suggest what helps `aisf:design`: where
tokens live and how to dump them, where fonts and icons live locally. Content is free-form:
whatever the owner wants.

Every slot file has frontmatter `name`, `description` and `user-invocable: false`.

Done: every slot (`project-design` only on `yes`) has a draft in `drafts/`, every section is in the ledger.
Exits: every slot drafted → 4.

## 4. Verify the toolchain

Run `analyze` and `test` from the draft `aisf-toolchain` block once. Show the output on the
review page. A failure is a finding for the owner: it may be a real repo defect. Never edit the
repo's code to make it pass.

Done: the output of both commands is in hand.
Exits: output in hand → 5.

## 5. Review page

Show **one** page (`aisf:artifacts`, id `onboard-<n>`), one `<aisf-question>` per section not yet
confirmed. Each shows:

- a source badge as `<aisf-meta label="Source">`: `migrated`, `scanned`, `suggested` or `you said`;
- the draft as `<aisf-context kind="code">`;
- cards `confirm` and, via the text field, the edit text.

Submit needs every question answered: that is the explicit confirm or edit. Apply edits, update
the ledger, re-show only what changed or is still open. Repeat until every section is
confirmed. Also ask, per file, whether to delete each old copy.

Accepted suggestions that need code changes are not done here. Post each as a bare idea
through `aisf:github-issue`.

Done: every section is `confirmed` or `edited` in the ledger; a delete answer per old copy; every accepted code-change suggestion posted as a bare idea.
Exits: a section still open or edited → 5 (republish) · every section confirmed → 6.

## 6. Write and commit

Write the slot files from the confirmed drafts. Check `project-toolchain` begins with the fenced
`yaml aisf-toolchain` block holding exactly `format, analyze, test, test_file, manifests, registry, platforms`.
Delete the old copies the owner agreed to. Then:

```bash
git add .claude
git commit -m "docs(onboarding): add project slots" -m "refs #<n>"
```

End the message with the attribution lines the session was given.

Done: one commit holds the slot files and the agreed deletions.
Exits: committed → 7.

## 7. PR

Load `aisf:pr`.

Done: the PR is open and the ticket is `in-review`.
Exits: PR open, ticket in-review → done.

## Output

The slot files in `.claude/skills/` in one commit on the run's branch, one open PR, the ticket `in-review`, a bare idea per accepted code-change suggestion.
