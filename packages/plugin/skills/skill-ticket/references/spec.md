# Spec

The body of one `type: skill` ticket. `aisf:skill-implement-ticket` sees this and nothing else:
write it for a reader with no memory of the interview. It describes behaviour, not prose. The
implementer writes the text per `writing-for-agents`.

    ## Context
    One sentence: why this skill is new or changes.

    ## Skill
    - Path: `packages/plugin/skills/<name>/SKILL.md` (or the agent / command file)
    - New | Changed
    - Invocation: user (`disable-model-invocation: true`) | model, with the description

    ## Role and goal
    Who the agent is. What it is trying to achieve.

    ## Parameters
    - `<n>`: …

    ## General rules
    Rules that hold for every step. Each names the skill it points to.

    ## Graph
    ```mermaid
    flowchart TD
      1[Read] --> 2[Purpose]
      2 -->|precondition fails| E((escalate))
    ```

    ## Steps
    ### 1. <Name>
    - Goal:
    - Actions:
    - Uses: skills, agents, tools
    - Done:
    - Output:
    - Exits: `<condition> → <node | done | escalate | stop>`

    ## Output
    What exists when the skill is done.

    ## Scope
    In: …
    Out: …

    ## Acceptance criteria
    Observable in the skill text: "Step 3 invokes `aisf:tdd`", "Every step has a done-check".

The graph in the ticket and `graph.json` hold the same nodes and exits.
