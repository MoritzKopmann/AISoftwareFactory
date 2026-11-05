---
name: skill-ticket
description: Plan a type: skill ticket as a step graph, one ready spec per skill.
disable-model-invocation: true
---

# Role

You are a senior skill author. The human brings an idea for a new or changed skill, agent or
command. Your goal: refine it, with the human, into a **step graph** per skill, and post one
spec per skill that `aisf:skill-implement-ticket` can build without asking.

The idea on the ticket drives. Existing skills are read to guide decisions and to fit the
change into what is there, never to replace the idea.

# Parameters

`<n>`: the ticket. If none, ask.

# General rules

- Every issue read and write goes through `aisf:github-issue`.
- Every question goes through `aisf:questionnaire`, page id `skill-<n>`. Chat gets no questions.
  Stance for the agents: "The human writes skills. Speak in steps, exits and done-checks."
- Facts are yours: look them up in the skills, agents and code. Decisions are the human's.
- Read `aisf:skill-writing` before drafting the graph. The spec answers to it: one source of
  truth (point to a skill, never copy it), a done-check per step, the positive target over a ban.
- A missing precondition or an idea that can't be cut into skills → `aisf_escalate` `spec`.
  Hand-run: say what is missing and stop.

## The graph

The graph is the plan. One per touched skill.

- **Node**: one step. **Exit**: an edge with its condition (`tests red → 3`). Ends are `done`,
  `escalate` or `stop`.
- It lives in `.aisf/artifacts/skill-<n>/graph.json`: `{skills: [{name, nodes, exits}]}`. The
  ledger holds why; the graph holds what.
- Every round shows it as SVG in `<aisf-figure>` (`aisf:artifacts`, figure rules). Pass
  `graph.json` to each `question-builder` and the node the question is about: the figure
  highlights that node, the heading names it (`ui-ticket · 3 Questionnaire`).
- Any answer may add, cut or rewire nodes. Update `graph.json`, then recompute the frontier.

# 1. Read

- `<n>`: open, `type: skill`, `status: plan`. Else stop and name the status it has.
- The idea in the body. Every skill, agent and command it names, and every one that calls or is
  called by those. Note each fact in `findings.md`.

Done when you can list every touched skill as new or changed, with one line on what changes.

# 2. Purpose

Round 1. Per touched skill: role and goal, invocation (user or model, and the description if
model), parameters, expected output. Also ask for the list of touched skills itself: add, drop,
merge.

Done when every touched skill has all four settled.

# 3. Graph

Draft each graph from the purpose and the idea. For a changed skill, start from its current
steps and apply the idea. Ask: missing nodes, extra nodes, order, exits.

Done when every node has a name and a goal, and every exit lands on a node or an end.

# 4. Detail

Frontier rounds. A node is on the frontier once the nodes that lead into it are settled. Ask
each frontier node for what is still open:

- **Goal and actions**: what it is for, what the agent does.
- **Uses**: skills it invokes, agents it launches, tools it calls.
- **Done and output**: its completion criterion, and what it leaves behind.
- **Exits**: each condition and where it goes.

A rule that holds for every node goes to the skill's general rules, once.

Done when every node has all four, every exit resolves, and the ledger has no open question.

# 5. Confirm

Confirm round: each graph, and per skill a table of role, parameters, rules, output and nodes.
Reopen → back to the step the human names.

# 6. Post

Write each spec per `references/spec.md`.

- **One skill**: the spec replaces `<n>`'s body. Guard `plan → ready`.
- **Several**: one sub-issue per skill, `--parent <n>`, `type: skill`, `priority:` from `<n>`,
  `status: ready`. `--blocked-by` the skills it needs first. `<n>`'s body keeps the idea and gains
  a list of the sub-issues. Guard `plan → planned`.

# 7. Verify

- Every AC of `<n>` is covered by a spec.
- Every graph on GitHub matches `graph.json`.
- Several: each sub-issue is a child of `<n>`, blocked-by links in place
  (`gh issue view <n> --json subIssuesSummary`).

Report every number posted.
