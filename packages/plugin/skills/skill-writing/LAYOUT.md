# Layout

Part of [`aisf:skill-writing`](SKILL.md): two layouts. The step layout and step shape bind step documents (documents run start to finish). The rule layout follows below and binds rule skills (documents consulted on demand).

## Layout

In this order:

1. **Role and goal**
2. **Parameters**
3. **General rules**: a rule that holds for every step goes here, once.
4. **Steps**: numbered.
5. **Output**

## Step shape

Labelled bullets, in this order:

- **Goal**: the step's direction.
- **Actions**: its path.
- **Uses**: its tools.
- **Done**: its expected outcome, the completion criterion.
- **Output**: what the step produces.
- **Exits**: the only place routing is written. One sub-bullet per exit: `<condition> → <target>`.
  - Condition: checkable ("the Confirm event is `reopen`", not "not confirmed"). A step's only exit restates its Done.
  - Target: a step, `done`, `escalate` or `stop`.
  - Back-exit (target an earlier step): names every later step that runs again before this step is reached once more, or says none does ("→ 4, then 7, 8 and 9 again").
  - A back-exit whose re-run steps have an Output says what carries over and what is void ("the ledger stays; the split draft is void").
  - A step reached from several steps that returns to its sender: one exit per sender only when the targets differ ("sent from 5 → 6", "sent from 7 → 7").

Goal, Actions, Uses and Output are optional: a step leaves one out when it has nothing to say. Done and Exits are never left out.

## Agents

An agent definition uses the same names: Parameters for its input, Output for its return. Its Output gives the exact block its caller reads.

## Rule layout

In this order; a part with nothing to say is left out:

1. Frontmatter
2. A machine-read block a consumer needs (e.g. `aisf-toolchain`)
3. **Scope**: one or two lines: what the rules cover.
4. **Model**: the short mental model the rules rest on.
5. **General rules**: rules that hold across every topic, once.
6. One H2 per topic
7. **Steps** (mixed only)
8. `## Load also` (slot only, last, heading unchanged)

### One rule

`<ID>. **Must:** <positive target, one line>` or `**Should:**`.

- ID: two uppercase letters from the topic plus a number (`NA1`, `PR3`), unique in the skill. An ID is stable: never reused, never renumbered.
- A reason (why) and an example only when the rule needs them, under the rule.
- An exception is a sub-bullet under its rule.
- A lint-checked rule keeps its lint tag as a separate bracket after the ID: `PR3. [L5] **Must:** …`.
- Cite a rule as `<skill> <ID>` (`code-rules NA1`).

### Facts, pointers, disclosed files

- **Facts**: a topic may hold an unnumbered fact table or short prose beside its rules. Only rules get IDs.
- **Pointers**: a pointer to a disclosed file sits beside the topic or step that uses it.
- **Disclosed rule file** (e.g. `references/rules.md`): same layout, minus frontmatter.

### Steps part (mixed)

`## Steps`, one H3 per recipe. Each recipe is numbered from 1 in the step shape above (Goal, Actions, Uses, Done, Output, Exits), any length. A recipe cites rule IDs; it never restates a rule.
