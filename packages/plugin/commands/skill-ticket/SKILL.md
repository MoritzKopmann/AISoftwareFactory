---
name: skill-ticket
description: Plan a type: skill ticket as a step graph, one ready spec per skill.
disable-model-invocation: true
---

# Role and goal

You are a senior skill author. The human brings an idea for a new or changed skill, agent or
command. Your goal: refine it, with the human, into a **step graph** per skill, and post one
spec per skill that `aisf:skill-implement-ticket` can build without asking.

The idea on the ticket drives. Existing skills guide decisions and show where the change fits.
They never replace the idea.

# Parameters

`<n>`: the ticket.

# General rules

- Every issue read and write goes through `aisf:github-issue`.
- Every question goes through `aisf:questionnaire`, page id `skill-<n>`. Stance for the agents:
  "The human writes skills. Speak in steps, exits and done-checks."
- Read `aisf:skill-writing` before drafting the graph. The spec answers to it.
- The graph is the plan, one per touched skill. It lives in
  `.aisf/artifacts/skill-<n>/graph.json`: `{skills: [{name, nodes, exits}]}`. The ledger holds
  why. The graph holds what.
- Every round shows the graph as SVG in `<aisf-figure>` (`aisf:artifacts`, figure rules). Pass
  `graph.json` to each `question-builder` and the node the question is about: the figure
  highlights that node, the heading names it (`ui-ticket · 3 Questionnaire`).
- Any answer may add, cut or rewire nodes. Update `graph.json`.

# Graph

```mermaid
flowchart TD
  1[1 Read] -->|touched skills listed| 2[2 Purpose]
  1 -->|n not open, not type: skill or not status: plan| S((stop))
  1 -->|idea can't be cut into skills| E((escalate))
  2 -->|purpose settled| 3[3 Graph]
  3 -->|graph drafted| 4[4 Detail]
  4 -->|ledger has no open question| 5[5 Confirm]
  5 -->|confirmed| 6[6 Post]
  5 -->|reopen| R{{step the human names: 2, 3 or 4}}
  6 --> 7[7 Verify]
  7 -->|a check fails| 6
  7 -->|every check passes| D((done))
```

# Steps

## 1. Read

- **Goal**: know every touched skill and what changes in it.
- **Actions**: check `<n>` is open, `type: skill`, `status: plan`. Read the idea in the body.
  Read every skill, agent and command it names, and every one that calls or is called by those.
  Note each fact in `findings.md`.
- **Uses**: `aisf:github-issue`.
- **Done**: every touched skill is listed as new or changed, with one line on what changes.
- **Output**: `findings.md`.
- **Exits**: `<n>` not open, not `type: skill` or not `status: plan` → stop, naming the status
  it has · the idea can't be cut into skills → escalate (`aisf_escalate` `spec`) · listed → 2.

## 2. Purpose

- **Goal**: settle what each touched skill is for.
- **Actions**: round 1. Per touched skill: role and goal, invocation (user or model, and the
  description if model), parameters, expected output. Also ask for the list of touched skills
  itself: add, drop, merge.
- **Uses**: `aisf:questionnaire`.
- **Done**: every touched skill has all four settled.
- **Output**: ledger rows.
- **Exits**: settled → 3.

## 3. Graph

- **Goal**: one graph per touched skill.
- **Actions**: draft each graph from the purpose and the idea. For a changed skill, start from
  its current steps and apply the idea. Ask: missing nodes, extra nodes, order, exits.
- **Uses**: `aisf:questionnaire`.
- **Done**: every node has a name and a goal, and every exit lands on a node or an end.
- **Output**: `graph.json`.
- **Exits**: drafted → 4.

## 4. Detail

- **Goal**: every node fully specified.
- **Actions**: rounds per `aisf:questionnaire`. Per node, ask every step field of
  `references/spec.md` still open.
- **Uses**: `aisf:questionnaire`.
- **Done**: every node has every step field, every exit resolves, and the ledger has no open
  question.
- **Output**: `graph.json`, ledger.
- **Exits**: no open question → 5.

## 5. Confirm

- **Goal**: the human confirms the plan.
- **Actions**: Confirm round: each graph, and per skill a table of role, parameters, rules,
  output and nodes.
- **Uses**: `aisf:questionnaire`.
- **Done**: the human confirms or reopens.
- **Exits**: confirmed → 6 · reopen → the step the human names (2, 3 or 4).

## 6. Post

- **Goal**: one spec per skill on GitHub.
- **Actions**: write each spec per `references/spec.md`. One skill: the spec replaces `<n>`'s
  body; guard `plan → ready`. Several: one sub-issue per skill, `type: skill`, blocked by the
  skills it needs first; `<n>`'s body keeps the idea and lists them.
- **Uses**: `aisf:github-issue`.
- **Done**: every spec is posted.
- **Output**: the issue numbers.
- **Exits**: posted → 7.

## 7. Verify

- **Goal**: GitHub holds what was confirmed.
- **Actions**: check every AC of `<n>` is covered by a spec. Check every graph on GitHub matches
  `graph.json`. Several: each sub-issue is a child of `<n>`, blocked-by links in place.
- **Done**: every check passes.
- **Output**: a report of every number posted.
- **Exits**: a check fails → 6, fix the body or link · every check passes → done.

# Output

One ready spec per touched skill on GitHub, and a report of every number posted.
