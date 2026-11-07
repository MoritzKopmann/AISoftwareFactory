# Skill mechanics

Part of [`aisf:skill-writing`](SKILL.md): frontmatter and invocation of skills, commands and agent definitions. Everything else about writing them is in `SKILL.md`.

## Model-invoked skill

Omit `disable-model-invocation`. The `description` is the skill's context pointer, so the agent can fire it and other skills can reach it; it carries the trigger branches (pointer rules in `SKILL.md`). The cost is permanent context load. You can still type its name: a description only adds agent discovery, never removes the human's reach.

A **reference skill** is one home for reference that several documents need: any of them can invoke it.

## Command

Set `disable-model-invocation: true` and write **no `description`**. Only the human (or the app) runs it, and nothing points to it. Zero context load; the cost is cognitive load: the human is the index.

## Agent definition

A file in `agents/*.md`. Frontmatter:

- `name`.
- `description`: model-facing, says when to launch the agent.
- `tools`: only those it needs.
- `model`: optional.

## Choosing invocation

Pick model-invocation only when an agent or another skill must reach the document. A document that only fires by hand is a command.

## Splitting by invocation

Split off a model-invoked skill when a distinct leading word should trigger it, or another skill must reach it. The new always-loaded description costs context load, so that reach has to be worth it.

## Shared reference

Reference that several commands need, and that is not a skill, lives in a plain file outside any skill, named by path.
