---
name: create-bug-ticket
description: Reproduce a type: bug idea, then write it as a ready bug ticket with cause and trigger, or close it.
disable-model-invocation: true
---

# create-bug-ticket

## Role and goal

Turn a `type: bug` idea into a ready bug ticket with proof: how it happens, its cause, and how to trigger it in the app. Or close it when it can't be reproduced and the human scraps it. Bugs skip the plan session.

## Parameters

- `<n>`: the bug idea. Required.

## General rules

- Every issue read and write goes through `aisf:github-issue`.
- Every question goes through `aisf:questionnaire`, page id `bug-<n>`. Stance: "what goes wrong and why; facts from the code; no fix design". Ledger line: `area · answer · round N`.
- Facts are found from the issue, the code and `git`. The human is asked only after a failed reproduction (step 4).
- `findings.md` is `.aisf/artifacts/bug-<n>/findings.md`.

## Steps

### 1. Read

- **Goal**: an open bug idea in view, the project slots loaded.
- **Actions**: read issue `<n>` (title, body, labels, state, comments). Open, `type: bug`, no `status:` label → go on. Load `project-toolchain`, `project-architecture` and `project-testing` with the Skill tool (bare names).
- **Uses**: `aisf:github-issue`, Skill tool.
- **Done**: the issue text and comments are in view; the three slots are loaded.
- **Exits**:
  - open `type: bug` idea, three slots loaded → 2
  - closed, a `status:` label, or no `type: bug` → stop (name its state, write nothing)
  - Unknown skill → stop ("project not onboarded")

### 2. Gather

- **Goal**: what the reproduce agent needs, found from the sources alone.
- **Actions**: from the issue text, the comments, a run finding's Kind and Location, the code there, and `git log` since the report: write the suspected trigger, expected vs actual, and the location to `findings.md`. This step holds no question. Entered from 4: add the human's redescription and gap answers from `ledger.md`.
- **Uses**: Read, Grep, `git`.
- **Done**: a trigger guess, expected vs actual and the location are in `findings.md`.
- **Output**: `findings.md` lines.
- **Exits**:
  - trigger guess, expected vs actual and location in `findings.md` → 3

### 3. Reproduce

- **Goal**: the bug shown or ruled out.
- **Actions**: dispatch one research agent. Its prompt holds the `findings.md` lines and says: "The checkout is read-only. Throwaway files only, deleted after. No commit, push or PR. Report findings only." The agent sorts the bug by `project-testing`: unit-testable → it writes and runs a failing test or script and pastes the output; else it pins file:line and writes trigger steps for a hand check. It checks whether the bug is already fixed (`git log` on the location since the report). It returns this report block:
  - `reproduced`: yes | no
  - `kind`: run | hand
  - `steps`, `expected`, `actual`
  - `cause`: file:line, one line why
  - `trigger`: steps in the app
  - `evidence`: the run output (kind run)
  - for no: `already-fixed` (commit or none), `reason`, `gaps` (questions only the human can answer)
- **Uses**: research agent.
- **Done**: the report holds every field its verdict needs.
- **Output**: the report.
- **Exits**:
  - `reproduced: yes` → 5
  - `reproduced: no` → 4

### 4. Not reproduced

- **Goal**: the human picks redescribe or scrap.
- **Actions**: one round per `aisf:questionnaire`: the report (already-fixed check or failure reason) as the figure; a card `next` with the options redescribe and scrap; one card per gap in the report. Scrap → close `<n>` through `aisf:github-issue` Close, the report as the comment.
- **Uses**: `aisf:questionnaire`, `aisf:github-issue`.
- **Done**: the answer is in the ledger; on scrap the issue is closed.
- **Output**: ledger lines.
- **Exits**:
  - the `next` answer is redescribe, every gap answered → 2, then 3 again (`ledger.md` and `findings.md` stay; the old report is void)
  - the `next` answer is scrap, issue closed → done
  - the `next` answer is neither, or unclear → 4 (asked again next round; nothing is void)

### 5. Write

- **Goal**: the issue is a ready bug ticket.
- **Actions**: rewrite the title (outcome-phrased) and the body:
  - `## Context`
  - `## Reproduction`: steps, expected vs actual, environment
  - `## Cause`: file:line, why
  - `## Trigger`: steps in the app
  - `## Evidence`: the run output, or "hand check: run the Trigger"
  - `## Acceptance criteria`: given the Trigger, the expected result

  Infer the priority from the report: who is hit, is there a workaround, is data lost. Write through `aisf:github-issue` Edit an idea in place: guard `idea → ready`, keep `type: bug`, add `priority:` and `status: ready`.

- **Uses**: `aisf:github-issue`.
- **Done**: title, body, `priority:` and `status: ready` are written.
- **Output**: the issue number and status.
- **Exits**:
  - guard mismatch → stop
  - issue written, number and status reported → done

## Output

`<n>` a ready `type: bug` ticket with Context, Reproduction, Cause, Trigger, Evidence and Acceptance criteria, and a `priority:`. Or `<n>` closed as not planned with the report as a comment. The report names the number and its state.
