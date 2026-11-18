# Spec

The body of one `type: skill` ticket. `aisf:skill-implement-ticket` sees this and nothing else:
write it for a reader with no memory of the interview. It describes behaviour, not prose. The
implementer writes the text per `aisf:skill-writing`.

    ## Context
    One sentence: why this skill is new or changes.

    ## Skill
    - Path: one of skill-ticket's accepted locations (general rules); several files may be listed
    - New | Changed
    - Invocation: user (`disable-model-invocation: true`) | model, with the description

    ## Role and goal
    Who the agent is. What it is trying to achieve.

    ## Parameters
    - `<n>`: …

    ## General rules
    Rules that hold for every step. Each names the skill it points to.

    ## Steps
    ### 1. <Name>
    - Goal:
    - Actions:
    - Uses: skills, agents, tools
    - Done:
    - Output:
    - Exits:
      - `<condition> → <step | done | escalate | stop>`

    ## Sections
    One `### <H2 name>` per section, in file order.
    ### <H2 name>
    - Goal:
    - Content: the rules and facts it must hold
    - Done:

    ## Output
    What exists when the skill is done.

    ## Scope
    In: …
    Out: …

    ## Acceptance criteria
    Observable in the skill text: "Step 3 invokes `aisf:tdd`", "Every step has a done-check".

## Kinds

- **Step skill**: the template above, with Steps.
- **Rule skill**: Context, Skill, Role and goal, Sections, Scope, Acceptance criteria. It drops
  Parameters, Steps and Output. General rules stay only if the skill has a General rules part.
- **Mixed skill**: Sections, and for its Steps part `## Steps` (one `###` per recipe, step
  fields per step).
- **Changed skill**: Context, Skill, Scope, Acceptance criteria. For a form-only change of an
  existing skill (e.g. rewrite every exit to the exit form, routing unchanged). The acceptance
  criteria carry the whole change.

The steps, exits and sections in the ticket and `graph.json` match.
