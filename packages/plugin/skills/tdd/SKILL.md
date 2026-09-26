---
name: tdd
description: Enforces Test-Driven Development (Red-Green-Refactor). Invoke when the user says "use TDD", "write test first", "do TDD", or when implementing any feature with TDD discipline. Must be invoked before writing any production code.
user-invocable: false
---

# TDD

Enforces the Red-Green-Refactor cycle. Never write production code before a failing test exists.

**Project slots.** Before the first Red, load `project-testing` and `project-toolchain` with
the Skill tool (bare names), then every skill `project-testing` names under `## Load also`.
If either slot returns `Unknown skill`, stop and report "project not onboarded". Do not
improvise commands, test locations or names.

## The Cycle

1. **Red** — Write a test for the _next single behavior_. Run it with `test_file` from the
   `aisf-toolchain` block in `project-toolchain`. It must fail.
2. **Green** — Write the _minimum_ production code to make it pass. Nothing more. Re-run
   `test_file`, then the whole suite with `test`.
3. **Refactor** — Clean up code and tests. Keep all tests green (`test`).

Repeat immediately from Red until the feature is fully covered by passing tests.

## Rules

- One behavior per cycle. Never batch multiple behaviors into one Red step.
- If the test passes without any production code, the test is wrong — rewrite it.
- Refactor means _clean up_, not _add features_. New behavior always starts a new Red.

## Naming and layout

Test names, file names and where a test lives follow `project-testing`
`## Layout and naming`.

## Every test

- **Isolated** — fresh subject per test, no shared mutable state. Multi-step tests build and
  dispose in the test framework's setup/teardown hooks.
- **Deterministic** — await async work to completion; never sleep or guess timing.
- **Outcome-asserting** — assert the observable result, not how it was produced.

## Untestable changes

Only the kinds of change that `project-testing` `## Mechanics` declares not unit-testable may
skip Red, and each uses the proof that section names for it instead of a failing test.
Record every skip, with the proof used, in the PR's `## Decisions made`. Anything not
declared there gets a failing test first.

## Integration

`project-testing` and the skills in its `## Load also` cover _how_ tests are written in this
project: runner, fakes, fixtures. This skill governs _when_: tests come first, always.
