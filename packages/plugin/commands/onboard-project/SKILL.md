---
name: onboard-project
disable-model-invocation: true
description: Write basic project slots with the owner, post one skill ticket per slot, and deliver the slots as one PR.
---

# onboard-project

## Role and goal

Onboard a target repo. Write basic slots that pass the contract: `project-toolchain` in full and owner-confirmed, every other slot frontmatter only. Post one `type: skill` ticket per written slot to fill it. Deliver the slots as one PR. Merging it is the approval.

## Parameters

`<n>`: the onboarding issue.

## General rules

- Every issue read and write goes through `aisf:github-issue`.
- The project has no slots yet. **Never call a skill that loads a project slot**
  (`aisf:commit`, `aisf:tdd`, `aisf:review-*`): they stop with "project not onboarded". Commit
  with `git` directly.

## Steps

### 1. Read

- **Goal**: claim or resume the onboarding issue.
- **Actions**: read the issue (title, body, labels, state) through `aisf:github-issue`. `status: ready` → guarded `ready → in-progress`, before any file work. `status: in-progress` → resume, no guard.
- **Uses**: `aisf:github-issue`.
- **Done**: the issue is `type: onboard` and `in-progress`.
- **Exits**:
  - the issue is `type: onboard` and was claimed or resumed → 2
  - other type or state, or guard mismatch → stop (name the state, write nothing)

### 2. Ledger

- **Goal**: know every settled answer and every posted slot ticket before acting.
- **Actions**: state lives in `.aisf/artifacts/onboard-<n>/` (gitignored). Read both first:
  - `ledger.json`: `{ "<slot>": { "<section>": "confirmed" | "edited" | "open" }, "tickets": { "<slot>": <number> } }`
  - `drafts/<slot>/…`: the draft files as last shown.

  A section marked `confirmed` or `edited` is never asked again. Update the ledger right after each answer, before the next step.

- **Uses**: Read.
- **Done**: ledger and drafts read, or known absent (new run).
- **Exits**:
  - ledger and drafts read, or known absent → 3

### 3. Draft toolchain

- **Goal**: a full `project-toolchain` draft from the repo and the owner.
- **Actions**: sources, in this order:
  1. **Migrate** existing docs: `CLAUDE.md`, `README`, `.claude/commands/*`, `.claude/skills/*`.
  2. **Scan** the repo: manifests, CI, scripts, tree, tests.
  3. **Ask** for unwritten knowledge.
  4. **Suggest** missing best practices from stack knowledge. Suggestions only: never put one in the slot unconfirmed.

  A repo with no docs runs the same flow. Step 1 finds nothing, so the interview leads.
  Shape the draft by `references/shape-project-toolchain.md`. Shapes are structure only; on form the rule layout of `aisf:skill-writing` wins. Existing docs and old skill copies are mined for the toolchain only. Nothing is deleted.

- **Uses**: `aisf:skill-writing`, `references/shape-project-toolchain.md`.
- **Done**: the draft holds the `aisf-toolchain` block with its 7 keys and the prose parts; every section is in the ledger.
- **Output**: `drafts/project-toolchain/SKILL.md`.
- **Exits**:
  - the draft holds the `aisf-toolchain` block and every section is in the ledger → 4

### 4. Stub other slots

- **Goal**: a frontmatter-only draft per other slot.
- **Actions**:
  - Ask the frontend question alone, as round 1 of page `onboard-<n>` (`aisf:artifacts`): cards `yes` and `no`, ledger section `project-design.frontend`. Never ask it again.
  - Stub `project-architecture`, `code-rules`, `project-testing`, and `project-design` only on `yes`. A stub is frontmatter only: `name`, `description`, `user-invocable: false`. No body, no `references/rules.md`, no Visual rendering recipe.
  - `description`: the default from the table below. The review page asks confirm or edit. One ledger section `<slot>.description` per stub.
  - A file already at the slot path is kept as is when it has the three frontmatter keys; else the stub adds the missing frontmatter and keeps the body.

  | Slot                   | Default description                                                                                                              |
  | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
  | `project-architecture` | Where code belongs in this project and how its parts talk. Use when writing, moving, reviewing or planning code.                 |
  | `code-rules`           | Code rules for review: naming, functions, conditions, layout, errors. Use when reviewing code for style and correctness-of-form. |
  | `project-testing`      | Testing reference: runner, test layout and naming, fakes and fixtures. Use when writing, placing or running tests.               |
  | `project-design`       | Design reference: where the tokens, fonts and icons of the app's look live. Use when designing or reviewing a screen.            |

- **Uses**: `aisf:artifacts`, tool `aisf_show_artifact`.
- **Done**: the frontend answer is in the ledger; every slot to write has a draft with the three frontmatter keys.
- **Output**: `drafts/<slot>/SKILL.md` per stubbed slot.
- **Exits**:
  - the frontend answer is in the ledger and every slot to write has a draft → 5

### 5. Verify toolchain

- **Goal**: know whether the drafted commands run.
- **Actions**: run `analyze` and `test` from the draft `aisf-toolchain` block once. Show the output on the review page. A failure is a finding for the owner: it may be a real repo defect. Never edit the repo's code to make it pass.
- **Done**: the output of both commands is in hand.
- **Exits**:
  - the output of `analyze` and `test` is in hand → 6

### 6. Review page

- **Goal**: the owner confirms or edits the basic content.
- **Actions**: on page `onboard-<n>`, the round after the frontend question, one `<aisf-question>` per section not yet confirmed: the `project-toolchain` sections, and one `<slot>.description` per stub. Each shows:
  - a source badge as `<aisf-meta label="Source">`: `migrated`, `scanned`, `suggested`, `you said`, or `default` for a description;
  - the draft as `<aisf-context kind="code">`;
  - card `confirm` and, via the text field, the edit text.

  Submit needs every question answered: that is the explicit confirm or edit. Apply edits, update the ledger, re-show only what changed or is still open. Repeat until every section is confirmed. Each accepted suggestion that needs code changes is not done here: post it as a bare idea through `aisf:github-issue`.

- **Uses**: `aisf:artifacts`, tool `aisf_show_artifact`, `aisf:github-issue`.
- **Done**: every section is `confirmed` or `edited` in the ledger; every accepted code-change suggestion posted as a bare idea.
- **Exits**:
  - a section is still `open` or `edited` → 6 again (republish; no later step runs again)
  - every section is `confirmed` in the ledger → 7

### 7. Write and commit

- **Goal**: the slot files in one commit.
- **Actions**: write each slot file from its confirmed draft to `.claude/skills/<slot>/SKILL.md`. Check `project-toolchain` begins with the fenced `yaml aisf-toolchain` block holding exactly `format, analyze, test, test_file, manifests, registry, platforms`. Delete nothing. Then:

  ```bash
  git add .claude
  git commit -m "docs(onboarding): add project slots" -m "refs #<n>"
  ```

  End the message with the attribution lines the session was given.

- **Uses**: `git`.
- **Done**: one commit holds every slot file to write.
- **Exits**:
  - one commit holds every slot file to write → 8

### 8. Slot tickets

- **Goal**: exactly one `type: skill` ticket per written slot, so each slot is filled through `aisf:skill-ticket`.
- **Actions**: per written slot (4, or 5 with `project-design`):
  - Skip it when `ledger.json` `tickets.<slot>` holds a number. When `ledger.json` is absent, read `gh issue view <n> --json blocking` and skip a slot whose path `.claude/skills/<slot>/` appears in a blocked issue's body.
  - Post through `aisf:github-issue` (Direct create): labels `type: skill`, `priority:` from `<n>`, `status: plan`; `--blocked-by <n>`; no `--parent` (a parent link makes `<n>` a non-leaf, which the app will not run).
  - Body, full anatomy:
    - Context: fill the slot onboarding left at contract minimum.
    - Skill: path `.claude/skills/<slot>/`.
    - Files to mine: the existing docs and old skill copies found in step 3 that bear on this slot; its PR proposes their deletion.
    - Scope: for `project-testing` with frontend `yes`, In names the Visual rendering recipe.
    - Acceptance criteria.
  - Write the number to `ledger.json` `tickets.<slot>` right after each post.
- **Uses**: `aisf:github-issue`, `gh`.
- **Done**: `tickets` holds a number per written slot, each issue `status: plan` and blocked by `<n>`.
- **Output**: 4 or 5 `type: skill` issues.
- **Exits**:
  - `tickets` holds a number per written slot → 9
  - a post fails → stop (report the `gh` output; `<n>` stays in-progress, so the next run resumes here)

### 9. PR

- **Goal**: ship the commit.
- **Actions**: load `aisf:pr`.
- **Uses**: `aisf:pr`.
- **Done**: the PR is open and the ticket is `in-review`.
- **Exits**:
  - the PR is open and the ticket is `in-review` → done

## Output

The slot files in `.claude/skills/` in one commit on the run's branch (`project-toolchain` full, the rest frontmatter only), one open PR, the ticket `in-review`, one `type: skill` ticket per written slot (`status: plan`, blocked by `<n>`), a bare idea per accepted code-change suggestion.
