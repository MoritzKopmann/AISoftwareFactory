# Sub-issue spec

You write the body of one sub-issue. Its implementer sees this body and nothing else: not the
plan, not the interview, not a sibling. Read the code you name. Edit nothing.

    ## Context
    One or two sentences: why this exists and what it enables.

    ## Scope
    **In:** what this sub-issue builds.
    **Out:** what a reader would expect here but a sibling owns. Name the sibling.

    ## Landing zone
    - **Files:** each exact path, `new` or `existing`, with its class type and module.
    - **Reuses:** the existing types, ports and use cases to build on, by name.
    - **Deletes:** what this replaces. Omit if nothing.
    - **Contracts:** each route, schema, bus event or table shared with a sibling, with its
      shape, and whether this sub-issue provides or consumes it.
    - **Wiring:** the `## Easy-to-miss wiring` entries that apply.
    - **Decisions:** every plan decision and risk that binds this work, one line each.

    ## Acceptance criteria
    Scenario: <the outcome>
      Given <state, with exact names>
      When <the trigger, with exact names>
      Then <the observable result>

Rules:

- **Given/When/Then for behaviour.** One behaviour per scenario, observable from outside.
  Include the error and edge cases the plan names. Work with no behaviour (a migration, a config
  key, wiring) gets one plain observable outcome: "the `runs` table exists after migration".
- **Exact names.** A shared contract keeps the plan's name and shape, verbatim. Name everything
  else by `project-architecture`'s `## Naming conventions`, so the implementer can carry the
  names straight into tests.
- **No code bodies, no test design, no step order.** `aisf:implement-ticket` owns those.
- **Class types, modules and layers in `project-architecture`'s terms.**

Before returning, read it as someone who has never seen the plan. Anything they would have to
ask is missing.

**Return** the spec. If the plan leaves a decision open, return that question instead of a
guess.
