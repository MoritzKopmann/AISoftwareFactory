# Layout

Part of [`aisf:skill-writing`](SKILL.md): one layout and one step shape for commands and agent definitions. Reference skills are not bound (rules in `SKILL.md`). The names match `packages/plugin/skills/skill-ticket/references/spec.md`.

## Layout

In this order:

1. **Role and goal**
2. **Parameters**
3. **General rules**: a rule that holds for every step goes here, once.
4. **Graph**: a mermaid flowchart, only when a step has more than one exit. A straight sequence has none.
5. **Steps**: numbered.
6. **Output**

## Step shape

Labelled bullets, in this order:

- **Goal**: the step's direction.
- **Actions**: its path.
- **Uses**: its tools.
- **Done**: its expected outcome, the completion criterion.
- **Output**: what the step produces.
- **Exits**: `<condition> → <target>`. The target is a step, `done`, `escalate` or `stop`.

A field with nothing to say is left out. Done and Exits are always there.

## Agents

An agent definition uses the same names: Parameters for its input, Output for its return. Its Output gives the exact block its caller reads.
