---
name: create-ticket
description: >
  Turn an idea issue (open, no status: label) into a ticket. Interviews the human in rounds on a
  bridge page, rewrites the issue in place, and ends at status: backlog
  or status: plan (a type: ui idea stays an idea). Splits surplus scope into bare ideas. Use when the user wants to create,
  refine or shape a ticket. Triggers: "create ticket", "refine #N", "turn #N into a ticket".
---

# create-ticket

Turn an idea into a ticket. Argument: issue number. If none (hand run), ask for a
one-sentence summary and create the issue yourself.

`gh` infers the repository from the current checkout. Never pass `-R`. Every issue write goes
through `aisf:github-issue`: its _Edit an idea in place_ for `#N`, _Interview-driven create_
with no number, _Bare ideas_ for spin-offs. Formatting and the cold-read test are its.

**Ask what and why, never how.** `aisf:plan-ticket` settles how.

## Precondition

```bash
gh issue view <n> --json title,body,labels,state,comments
```

- Open and no `status:` label → go on. Anything else → stop, name its state (`backlog`, …),
  write nothing.
- A gaps comment from `aisf:plan-ticket` (a spec sent back to idea) is ordinary input. It
  seeds the first rounds.

**Bridge page.** No `aisf_show_artifact` tool → stop: "create-ticket needs the bridge page".
Load `aisf:artifacts`.

**Project slots.** Load `project-toolchain` with the Skill tool (bare name). Load
`project-architecture` too (it decides a question below). `Unknown skill` → stop:
"project not onboarded". Load `project-index` if it exists. Skip silently if absent.

**Resume.** `.aisf/artifacts/create-<n>/ledger.md` exists → read it. Continue from it. Never
ask an answered round again.

## Files

For issue `<n>`:

- Page id: `create-<n>`. **One page for the whole session**, at
  `.aisf/artifacts/create-<n>/index.html`. `round-builder` adds each round to the same
  file. Republish with the same id.
- Ledger: `.aisf/artifacts/create-<n>/ledger.md`. Append after every round:
  `area · answer · round N`, plus open questions. Later steps read the ledger, not the
  scrollback.
- A hand run with no number has no `<n>` yet: ask the summary, create the bare issue first,
  then use its number. Skip the Precondition for that issue.

## Interview

Load `aisf:questionnaire` for the pattern, the agents and the page. create-ticket picks each
round's questions. Specific to create-ticket:

1. **Round 1.** Infer the type from the issue text and the gaps comment: `bug`, `enhancement`
   or `task` (a spike is a task whose deliverable is an answer), or `ui` only when the skill
   `project-design` exists (try loading it; skip silently if absent). Ask that type's track
   questions at once. No confirm-the-summary question and no pick-the-type question. Hand run
   with no number: ask the one-line summary in chat first, before the issue exists.
2. **Group the frontier.** Every question whose answer does not depend on another open one goes
   in the same round, across track areas. No cap on the count. The track lists the areas to
   cover, in its order. Cover every area. Skip one an earlier answer settled.
3. **Every question** is built by one `question-builder` agent, in parallel, with: page
   `create-<n>`, a name, the question, rough options drafted from the issue text and, when the
   slot exists, from `project-index`, and the stance "what is to be built only; no more technical
   than the requirement; effects in ticket terms (scope, criteria), never module or layer". Full
   cards. Plus the kit's free text field. No `suggested` card anywhere. Cards never offer an
   implementation choice.
4. **Each round.** Write `.aisf/artifacts/create-<n>/round-<N>.json` (contract in
   `agents/round-builder.md`). Run `round-builder` (page `create-<n>`, `N`, the absolute path of
   `skills/questionnaire/build-page.mjs`). Call `aisf_show_artifact` yourself (id `create-<n>`)
   and read the answers. There is no playback-builder and no `header.html`: the page has no
   playback and no header section.
5. **Stop when** the ticket passes the cold-read test. An unknown the human cannot settle goes
   into the ticket as an open question. Never omit it.

### Tracks

**Bug**

1. Reproduction: exact trigger steps, the state before the failure.
2. Expected vs actual: concrete behaviour.
3. Frequency and scope: always, sometimes, specific data or device.
4. Environment: platform options come from `project-toolchain`'s `platforms`; plus version
   and data state.
5. Impact: who is affected, is there a workaround.
6. Related tickets or commits.

**Enhancement or feature**

1. User and goal.
2. Trigger or entry point: where in the app the flow starts. Ask only when the feature has a
   surface a human sees.
3. Core behaviour: the happy path, step by step.
4. Edge cases and error states.
5. Non-goals: out of scope, explicitly. Use the `project-index` recall of the touched feature
   when the slot exists.
6. Persistence: what must survive the next launch.
7. Constraints the user would notice: offline, instant, one platform.
8. Design or UX reference. Only when the feature has UI.
9. Dependencies: blocked-by or related.

**UI**

Same what/why interview as the enhancement track. Ask nothing about layout: the design run
settles it.

**Task or spike**

1. Deliverable.
2. Why now: what it unblocks.
3. Constraints: time-box, output format.
4. Definition of done.

## Split

Answers show the idea is several tickets → one round proposes the split: the first part
(this ticket) and each other part with a one-line summary. Confirmed:

- Narrow the current ticket to the first part. Finish it as below.
- Post each other part as a **bare idea**: no labels, a one-line summary, `Split from #<n>`.
- No umbrella. No native sub-issue link.

## Summary round

The last round. Write the drafted ticket to `.aisf/artifacts/create-<n>/summary.html`:

- Title, context, scope, acceptance criteria.
- The labels: the inferred `type:` and the proposed `priority:`. Base the priority on the impact
  and why-now answers.
- Any proposed split.

Write `round-<N>.json` as:

```json
{
  "confirm": {
    "tasks": [{ "number": 1, "heading": "Plan next", "blockedBy": [], "hitl": false }],
    "summary": "summary.html"
  }
}
```

Run `round-builder`, then `aisf_show_artifact`. **Plan next** is the one task, **off by
default**. `"1": true` in the Confirm payload's `hitl` means on.

**Confirm locks it.** A Reopen with a note → back to the interview on that note. The note may
name another type: rerun that type's track areas.

## Write

Through `aisf:github-issue`, guard first (`idea → backlog`, `idea → plan`, or `idea → idea` for
`type: ui`).

1. Rewrite title and body in place. Full anatomy, cold-read test. Open questions stay in the
   body.
2. Labels: one `type:`, one `priority:`, and `status: backlog` (Plan next off) or
   `status: plan` (on). A `type: ui` idea gets no `status:` label and no Plan next switch: it
   stays an idea and the design run picks it up. **Never** `hitl`, **never** `domain:`.
3. A dependency is a native blocked-by (`--add-blocked-by`). "Related" stays a `Related: #N`
   body line.
4. Post the spin-offs.

Report the issue number, its status and each spin-off number. **Stop.** The skill never starts
`aisf:plan-ticket`.

## Anti-patterns

- Chaining into `aisf:plan-ticket`.
- Writing an umbrella for a split.
- Offering "how" choices on cards.
- A second page for the same session.
- A `suggested` card, a playback or a header on the page.
- Re-asking a round the ledger already holds.
