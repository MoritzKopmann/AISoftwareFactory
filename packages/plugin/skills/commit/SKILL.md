---
name: commit
description: "Produces a conventional commit — runs the project's format and analyze commands, fixes warnings in its own diff, derives type/scope, adds a ticket ref when one exists."
when_to_use: "user asks to commit, 'stage changes', or 'create a commit'; also invoked by other skills at the end of their workflow"
model: haiku
effort: low
---

# Commit Skill

Follow these steps **in order** every time you create a commit. Never ask the user
anything: this skill behaves the same in an unattended run and by hand.

**Project slots.** Load `project-toolchain` and `project-architecture` with the Skill tool
(bare names). If either returns `Unknown skill`, stop and report "project not onboarded".
Do not improvise commands or scopes.

---

## Step 1 — Format and analyze

Take `format` and `analyze` from the `aisf-toolchain` block in `project-toolchain`. Run
`format` first (it rewrites files in place — never skip it), then `analyze`, from the repo
root. Read the output as the prose under the block describes.

- **Errors anywhere** → stop, report them, do not commit.
- **Warnings in files this diff touches** → fix them, re-run `format` and `analyze`, and
  repeat until those files are clean. The fixes are part of this commit.
- **Warnings only in files this diff doesn't touch** → proceed, and list them in your report.
- **Clean** → continue.

---

## Step 2 — Gather information (run in parallel)

```bash
git status          # see staged vs unstaged files
git diff HEAD       # all pending changes (staged + unstaged combined)
git log --oneline -5
```

---

## Step 3 — Check for sensitive files

Never stage or commit files matching: `.env`, `*.pem`, `*.key`, `*secret*`, `*credentials*`, `*password*`.
If any are present in the diff, exclude them and say so in your report.

---

## Step 4 — Determine scope

Take the **module-root pattern** from `## Module layout` in `project-architecture`
(for example `src/<feature>/` or `packages/app/src/modules/<name>/`). The scope
is the placeholder segment of the root the changed files sit under.

| Changed path                                                            | Scope              |
| ----------------------------------------------------------------------- | ------------------ |
| Under one module root                                                   | that module's name |
| Under several unrelated module roots                                    | _(omit scope)_     |
| Outside module roots, where `project-architecture` names a scope for it | that scope         |
| Tests only                                                              | `test`             |
| Only files listed in the toolchain's `manifests`                        | `deps`             |
| `.claude/` / `CLAUDE.md` only                                           | `tooling`          |
| Anything else                                                           | _(omit scope)_     |

---

## Step 5 — Choose commit type

| Type       | When to use                              |
| ---------- | ---------------------------------------- |
| `feat`     | New user-facing feature or behaviour     |
| `fix`      | Bug fix                                  |
| `refactor` | Code change with no behaviour change     |
| `test`     | Adding or updating tests                 |
| `chore`    | Build, tooling, dependencies, CI         |
| `docs`     | Documentation only                       |
| `style`    | Formatting, lint fixes (no logic change) |
| `perf`     | Performance improvement                  |

---

## Step 6 — Find related tickets

Use this priority order — stop at the first level that produces a match:

**Priority 1 — branch name (definitive)**
Parse the current branch name. If it matches `aisf/<N>-*` (e.g. `aisf/37-plugin-github-issue-commit`), extract `N` as the issue number. Use `refs #N`.

**Priority 2 — no match**
If the branch name does not match the `aisf/<N>-*` pattern, omit the `refs` footer entirely. Do not guess.

---

## Step 7 — Draft the commit message

### Format

```
<type>(<scope>): <subject>

[optional body — the WHY, not the what]

[refs #N  — if related ticket exists]
```

### Rules

- **Subject**: imperative mood ("add X", not "added X"), max 72 characters, no trailing period.
- **Scope**: omit parentheses entirely when there is no scope.
- **Body**: include only when the _why_ is non-obvious. Skip for straightforward changes.
- **Ticket refs**: always on their own line, only when a ticket is found.
- **`BREAKING CHANGE:`**: add as a footer line when the change breaks existing behaviour.

### Examples

```
feat(scheduler): queue a run when another is active for the project

refs #3
```

```
fix(auth): prevent token refresh loop on 401 response

The previous implementation retried indefinitely because the error
handler triggered a new request before clearing the in-flight flag.

refs #34
```

```
chore(deps): add zod ^4.1.0
```

---

## Step 8 — Refresh the project index

If a `project-index` skill exists and any changed path is under a module root, invoke
`project-index` record for each touched module before staging. The refreshed index stages
with this commit. Skip silently if the skill is absent (`Unknown skill`) or no module root
is touched.

---

## Step 9 — Stage and commit

Stage only the files that belong to this logical change. Prefer explicit file paths over `git add -A`. Then commit using a HEREDOC to preserve formatting.

---

## Step 10 — Verify

Run `git status` after the commit to confirm the working tree is clean (or note any intentionally unstaged files).
