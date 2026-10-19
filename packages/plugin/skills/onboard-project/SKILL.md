---
name: onboard-project
description: >
  Draft a project's four slots (project-architecture, code-rules, project-testing,
  project-toolchain) with the owner and deliver them as one PR. Migrates existing docs, scans the
  repo, asks for unwritten knowledge, suggests best practices. Runs on a type: onboard issue.
  Use when the user wants to onboard a project. Triggers: "onboard #N", "onboard project".
---

# onboard-project

Draft the four slots with the owner. Deliver them as one PR. Merging it is the approval.
Argument: `<n>`, the onboarding issue. If none, ask.

The project has no slots yet. **Never call a skill that loads a project slot**
(`aisf:commit`, `aisf:tdd`, `aisf:review-*`): they stop with "project not onboarded". Commit
with `git` directly.

Every status change and issue write goes through `aisf:github-issue`. Never pass `-R`.

## Stop points

Mode is **AFK** when the `aisf_escalate` tool is present, **hand-run** otherwise. Decide once.

| Stop point                                       | AFK                                       | Hand-run                  |
| ------------------------------------------------ | ----------------------------------------- | ------------------------- |
| **escalate `spec`**: the issue can't be answered | `aisf_escalate({kind: 'spec', reason})`   | ask the concrete question |
| **escalate `denied`**: a needed call was refused | `aisf_escalate({kind: 'denied', reason})` | say what was denied, ask  |

AFK: A permission denial doesn't end your turn: the app asks the human. Told you may retry →
issue the identical call once, unchanged. Otherwise carry on without it.

Questions to the owner go on a bridge page (`aisf:artifacts`). Hand-run without a page tool:
ask in chat, same content.

## 0. Precondition

```bash
gh issue view <n> --json title,body,labels,state
```

Go on only for `type: onboard` at `status: ready` (new) or `status: in-progress` (resume). Anything else
→ stop, name the state. A stop here writes nothing.

## 1. Claim and branch

- New run: guarded `ready → in-progress` first, before any file work. Resume: nothing. A guard
  mismatch → stop, report the actual state.
- Branch is the run's own `aisf/<n>-<kebab title>`. Already on it → stay. Otherwise on a clean
  tree: `git fetch origin`, `git switch -c <branch> origin/main` (or `git switch <branch>` on resume).
  Dirty tree on another branch → AFK **escalate `spec`**, hand-run ask. Never stash or discard.

## 2. Restart ledger

State lives in `.aisf/artifacts/onboard-<n>/` (gitignored):

- `ledger.json`: `{ "<slot>": { "<section>": "confirmed" | "edited" | "open" } }`
- `drafts/<slot>/…`: the draft files as last shown.

**Read both first.** A section marked `confirmed` or `edited` is never asked again. Update the
ledger right after each answer, before the next step.

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

Every slot file has frontmatter `name`, `description` and `user-invocable: false`.

## 4. Verify the toolchain

Run `analyze` and `test` from the draft `aisf-toolchain` block once. Show the output on the
review page. A failure is a finding for the owner: it may be a real repo defect. Never edit the
repo's code to make it pass.

## 5. Review page

Show **one** page (`aisf:artifacts`, id `onboard-<n>`), one `<aisf-question>` per section not yet
confirmed. Each shows:

- a source badge as `<aisf-meta label="Source">`: `migrated`, `scanned`, `suggested` or `you said`;
- the draft as `<aisf-context kind="code">`;
- cards `confirm` and, via Other, the edit text.

Submit needs every question answered: that is the explicit confirm or edit. Apply edits, update
the ledger, re-show only what changed or is still open. Repeat until every section is
confirmed. Also ask, per file, whether to delete each old copy.

Accepted suggestions that need code changes are not done here. Post each as a bare idea
through `aisf:github-issue` (`Found while onboarding #<n>`).

## 6. Write and commit

Write the slot files from the confirmed drafts. Check `project-toolchain` begins with the fenced
`yaml aisf-toolchain` block holding exactly `format, analyze, test, test_file, manifests, registry, platforms`.
Delete the old copies the owner agreed to. Then:

```bash
git add .claude
git commit -m "docs(onboarding): add project slots" -m "refs #<n>"
```

End the message with the attribution lines the session was given.

## 7. PR

`git push -u origin HEAD`. Never force, never the default branch. Write the body with `aisf:pr`,
then append `Closes #<n>`. List the proposed deletions and the bare ideas posted in the body.
`gh pr create --body-file <tmp> --label "priority: <x>"` (`<x>` is the issue's `priority:` label)
against the default branch, title `docs(onboarding): add project slots`. Reuse an existing PR
with `gh pr edit`. Then guarded `in-progress → in-review`. Never skip it.

Report the PR URL in one line. Never merge, never close the issue.
