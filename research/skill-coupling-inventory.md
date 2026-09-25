# Skill coupling inventory: postkarte in the workflow skills

Resolves #4 (part of map #1). Research only. No skill was changed.

**Sources read**
- This repo: `.claude/commands/{create-ticket,plan-ticket,implement-ticket,commit}/SKILL.md` and `plan-ticket/example-page.html`. These are untracked locally, not on `main`.
- postkarte (`~/Software/postkarte`, read-only): `.claude/commands/*` (project-architecture, flutter-mvu, flutter-mvu-test, tdd, github-issue, review-simplicity, plus ui-ticket, ui-implement-ticket, code-audit), `.claude/scripts/bootstrap-labels.sh`, `.claude/features/*.md`, `CLAUDE.md`, and git history for the deleted `feature-docs`.

**Classes used below**
- **generic**: already project-neutral, or can be made neutral just by rewording.
- **parameter**: a fact the project supplies, such as a command, a path or a name.
- **judgment**: rules or know-how the project supplies as a skill.
- **derive**: a value that looks like a parameter but can be read from the environment (git remote, `gh`), so no project needs to supply it.

## Headline facts

1. **The four workflow skills here are byte-identical to postkarte's copies.** The same holds for `example-page.html`. Today they are copied by hand, and postkarte is the de facto upstream.
2. **`feature-docs` no longer exists.** postkarte deleted it on 2026-09-24 (commit `6e5ed50`). create-ticket, plan-ticket, implement-ticket and commit still call it, along with postkarte's ui-ticket and ui-implement-ticket. So every run already hits a dangling reference. Its data (`.claude/features/*.md`) is still in the repo and has gone stale.
3. **The repo slug `MoritzKopmann/postkarte` appears 12 times** across plan-ticket (4) and implement-ticket (8), and 5 more times in github-issue. All of these can be derived from `gh repo view`. No project needs to supply it.
4. **Stack commands appear on 12 lines across 3 skills.** They are `dart format lib test`, `flutter analyze` and `flutter test`, in commit, implement-ticket and review-simplicity.
5. **The deepest coupling is the plan-ticket planner persona.** It says "10+ years Flutter/Dart, deep flutter_mvu", "Places state in MVU terms… never StatefulWidget", and gives the plan template a Frontend section that asks for "Which Model, Events, StateView". This is judgment, not a parameter.
6. **claude.ai artifact coupling lives only in plan-ticket steps 4–5,** in the skill text. `example-page.html` is static HTML with one inline `<script>` and no `window.claude`/artifact runtime calls. It survives the move to locally served HTML as-is, apart from its content, which is postkarte issue #1059.
7. **There is a real bug in commit.** Its scope table maps `lib/<feature>/`, but postkarte's layout is `lib/features/<feature>/`. The scope therefore comes out as `features` unless the model corrects it.
8. **Of the 7 referenced project skills, only 3 are really project-specific:** project-architecture, flutter-mvu and flutter-mvu-test. tdd and review-simplicity are about 90% generic, and github-issue is about 80% generic.

## 1. Coupling table

Location is `skill:line`, using line numbers from this repo's copies.

### Repo and tracker

| # | Where | Coupling | Class | Note |
|---|---|---|---|---|
| R1 | plan-ticket:22,287,288,293 · implement-ticket:21,46,61,114,133,153,154,157 | `-R MoritzKopmann/postkarte`, `repos/MoritzKopmann/postkarte/...` | derive | `gh` defaults to the cwd repo. Drop `-R`, or use `gh repo view --json nameWithOwner`. |
| R2 | github-issue (postkarte) | Repo slug, GraphQL `owner:"MoritzKopmann", name:"postkarte"` | derive | Same as R1. |
| R3 | create-ticket:72 · plan-ticket:293,305 · implement-ticket:32,33,61,133 · github-issue | `status: backlog/ready/in-progress/in-review` state machine | generic | This is the app's workflow state (map #1: the app watches ticket state). The app should own it, not the project. |
| R4 | create-ticket:72 · github-issue · bootstrap-labels.sh | `type:`/`priority:` label sets | generic | Same for every project. Provisioning belongs to onboarding or the app, not to a per-project script. |
| R5 | create-ticket:72 · github-issue | `domain: map/trip/postcard/export` | derive | Project vocabulary, but `gh label list --search "domain:"` returns it. |
| R6 | plan-ticket:304 · implement-ticket:51,56 · commit:83 · github-issue | Branch `feature/<n>-<kebab>` off `main` | generic (+ derive base) | Pattern is workflow-owned. The default branch comes from `gh repo view --json defaultBranchRef`. |
| R7 | implement-ticket:148 | `gh pr merge --rebase` (linear history) | parameter (weak) | A project preference. Default to rebase and let a project override it. |
| R8 | plan-ticket:164,262 | `#1059`, `#860 under #826 is the model` | generic (remove) | postkarte issue numbers used as precedents. They point nowhere in another repo. Describe the pattern instead. |

### Stack commands

| # | Where | Coupling | Class |
|---|---|---|---|
| C1 | commit:20,24 | `dart format lib test` | parameter (format) |
| C2 | commit:3,21,25,26 · implement-ticket:75,87,96 · review-simplicity (postkarte) | `flutter analyze` + the `^(error\|warning\|Analyzing)` output filter | parameter (analyze/lint), and how to read its output |
| C3 | implement-ticket:75,79,96 · review-simplicity | `flutter test`, `flutter test <file>` | parameter (test all / test one) |
| C4 | plan-ticket:41–43 | Library pass: pub.dev popularity, `pubspec.yaml`, "Android **and** iOS support" | parameter (package registry, manifest, target platforms) |
| C5 | commit:58 | `pubspec.yaml`/`pubspec.lock` → scope `deps` | parameter (dependency manifest files) |

### Paths and layout

| # | Where | Coupling | Class |
|---|---|---|---|
| P1 | create-ticket:50 · commit:135,137 | `lib/features/<feature>/` as the unit of "feature" | parameter (module root pattern) |
| P2 | commit:50–59 | Scope table: `lib/<feature>/` (wrong, see headline 7), `lib/main.dart`, `test/` | parameter (module pattern, entry file, test root) |
| P3 | commit:59 | `.claude/` / `CLAUDE.md` → `tooling` | generic |
| P4 | tdd (postkarte) | Tests mirror `lib/` → `test/…_test.dart` | parameter/judgment (test layout) |

### Architecture and MVU rules

| # | Where | Coupling | Class |
|---|---|---|---|
| A1 | plan-ticket:32 · implement-ticket:47,65 | "Load `project-architecture` and `flutter-mvu`" | judgment (entry point to rules) |
| A2 | plan-ticket:55 | "Enforces `project-architecture`, `flutter-mvu` and `CLAUDE.md`" | judgment. CLAUDE.md is generic. |
| A3 | plan-ticket:62–63 | "Places state in MVU terms: which Model, which Events, which `StateView`. Never `StatefulWidget`" | judgment (state-placement vocabulary + hard bans) |
| A4 | plan-ticket:138 | "Never offer an illegal option. `StatefulWidget`, state outside a Model" | judgment (hard bans list). The mechanism is generic. |
| A5 | plan-ticket:220 | Plan template "Frontend: Which Model, Events, StateView" | judgment (plan vocabulary) |
| A6 | plan-ticket:276 | "a migration, a get_it registration" as easy-to-drop files | judgment (examples of wiring files that get missed) |
| A7 | implement-ticket:5 (description) | "with the project's MVU patterns" | generic (reword) |
| A8 | implement-ticket:64–65 | "MVU code/tests per `flutter-mvu`/`flutter-mvu-test`, placement per `project-architecture`" | judgment |

### Planner persona

| # | Where | Coupling | Class |
|---|---|---|---|
| S1 | plan-ticket:52–53 | "Seat: senior + frontend developer. 10+ years Flutter/Dart, deep flutter_mvu" | parameter (stack name) + judgment (expertise) |
| S2 | plan-ticket:56–59,64–66 | Homogeneity, reduction over addition, name failure modes, mark cheap paths | generic. This is the valuable core. |
| S3 | plan-ticket:60–61 | Decides UX: surface, layout, empty/loading/error states | generic for UI projects. It would be dead weight for a CLI or library. |
| S4 | plan-ticket:64–65 | Failure-mode examples: "migration traps, lifecycle leaks… platform quirks, jank" | generic enough (examples) |

### Docs recall

| # | Where | Coupling | Class |
|---|---|---|---|
| D1 | create-ticket:50 · plan-ticket:32 · implement-ticket:47,91 · commit:133–137 | `feature-docs` recall/record | judgment, but **the skill is gone** (headline 2) |

### claude.ai artifacts (plan-ticket only)

| # | Where | Coupling | Class |
|---|---|---|---|
| X1 | plan-ticket:106–107 | "one artifact per planning session; chat gets the link only". Load `artifact-design`, `artifact-capabilities`, `artifact-diagramming` | generic intent, with a platform-specific mechanism. Those three are claude.ai-provided skills. |
| X2 | plan-ticket:108 | `capabilities: {artifact: {}}` | platform-specific → replaced by the app's local HTML bridge |
| X3 | plan-ticket:116 | Save answers via `artifact.publish(html)`. "Copy answers" as the fallback | platform-specific → the app posts input into the session |
| X4 | plan-ticket:119 | "Read answers from the republish notice, only if the publish result confirmed a watch, else `read` the artifact" | platform-specific → the app delivers answers as messages |
| X5 | plan-ticket:122,157–158,193 | Same URL across rounds and Confirm; Confirm/Reopen "save like Submit" | generic intent (one living page per session) |
| X6 | plan-ticket:164 · example-page.html | Build Confirm from `example-page.html` | generic shape. Content is postkarte #1059 (Flutter lanes: `views/`, `model + events`, `core/service`, `infra + sqlite`). Needs a neutral example or per-project lanes. |
| X7 | plan-ticket:190 | "never linked from GitHub" | generic (still true with local HTML) |

### Smaller items

| # | Where | Coupling | Class |
|---|---|---|---|
| M1 | create-ticket:40 | Bug env "platform (Android/Linux/web)". Contradicts CLAUDE.md's Android/iOS. | parameter (target platforms), the same fact as C4 |
| M2 | create-ticket:29 · plan-ticket:148–150,227–228 | Examples: "store trips in SQLite", `trips` table, "Save trip → TripView fires SaveRequested…" | generic (neutral examples preferred, harmless otherwise) |
| M3 | commit:113,128 | Examples: "add bottom tab bar with MVU routing", `flutter_mvu ^1.1.0` | generic (neutral examples) |
| M4 | commit:5 | `model: haiku`, `effort: low` | generic |
| M5 | implement-ticket:79 | `git stash && flutter test <file>`, then pop | generic mechanism, parameter command. Note: shared stash is unsafe under worktrees and parallel sessions, which the app will run. |
| M6 | create-ticket:7 · plan-ticket:299 | "consult `github-issue`" | see skill roles below |

**Counts:** 43 rows. Roughly: 15 generic (about half need only a reword or a neutral example), 11 parameter, 9 judgment, 3 derive, 5 platform-specific (artifacts). Mixed rows are counted by their main class.

## 2. Role of each referenced project skill

| Skill | Role | Project-specific? | Evidence |
|---|---|---|---|
| **project-architecture** (251 lines) | Architecture rules: folder layout, class-type → location table, naming, DI (get_it), deep modules, cross-domain access, dependency direction, "views hold no logic", test mirroring, comment policy | **Truly project-specific.** Every rule names a postkarte path or construct. The *kind* of content (placement, layering, bans) is what every project needs. | Also has a `wc -l` < 400 rule for views and exceptions naming real files. |
| **flutter-mvu** (226 lines) | Library reference for the `flutter_mvu` package: Model/Event/StateView/ModelProvider, lifecycle, async pitfalls, GlobalEvent | **Stack-specific, not project-specific.** Would be the same in any flutter_mvu app. | `user-invocable: false`. It is reference material, loaded on demand. |
| **flutter-mvu-test** (144 lines) | Testing mechanics for flutter_mvu (`TestModelController`, async chains, GlobalEvent assertions) | Stack-specific | Defers naming to `/tdd`. |
| **tdd** (47 lines) | Testing discipline: Red-Green-Refactor, one behaviour per cycle, `should X when Y`, isolated/deterministic/outcome-asserting | **~90% generic.** Only the Layout section (`lib/` → `test/…_test.dart`, Dart example) and the pointer to `flutter-mvu-test` are project-specific. | Could be a generic skill that reads test layout from the testing slot. |
| **review-simplicity** (66 lines) | Post-implementation review: parallel read-only reviewers on 4 axes, auto-apply only safe fixes, report bugs/gaps | **~95% generic.** Only `flutter analyze` and "invoked by … ui-implement-ticket" are specific. | Uses the toolchain parameter for analyze/test. |
| **github-issue** (115 lines) | Issue formatting and tracker ops: cold-read test, ticket anatomy, label taxonomy, state transitions, native sub-issue GraphQL, posting | **~80% generic.** Specific: repo slug (derive), `domain:` values (derive), title examples (postkarte-flavoured), path of `bootstrap-labels.sh`. | Owns the ticket state machine the app will watch, so it should become generic and app-owned. |
| **feature-docs** (deleted) | Docs recall/record: per-feature *location index* (`.claude/features/<f>.md`, path → symbols) | Mechanism generic, data project-specific. **Removed by the owner**, and all callers still point at it. | Recovered from `6e5ed50^`. |
| **CLAUDE.md** (15 lines) | Writing-style rules, a certainty-marking rule, and the one hard ban (no `StatefulWidget`) | Project-specific. The style/certainty rules look like user preferences that belong in user-level config. | |

Out of scope but coupled the same way: postkarte also has **ui-ticket** and **ui-implement-ticket** (a design-driven variant of the ticket workflow), **code-audit** (reads the four rule skills by path) and **branch-cleanup**. ui-ticket and ui-implement-ticket are workflow skills too, and the map should decide whether they join the generic set.

## 3. Candidate convention-named slots

### Principles

- **One entry point per concern.** A generic skill calls the slot. The slot may point to further project-private skills (project-architecture → flutter-mvu). Library references like flutter-mvu are not slots. They are whatever the slot tells the model to load.
- **Derive before asking.** Anything readable from git/`gh` (repo, default branch, domain labels) is not a slot.
- **The workflow owns the workflow.** Status/type/priority labels, branch pattern, TDD discipline, simplicity review, commit format and ticket anatomy stay generic. The app ships them and the project does not author them.
- **Parameters want a fixed shape.** Commands and facts are consumed mechanically, possibly by the app as well as the skills, so they need fixed headings or a machine-readable block, not prose.

### Candidates considered

| Candidate | Would cover | Verdict |
|---|---|---|
| `project-architecture` | A1–A8, P1–P2, S1 stack line | **Keep (required).** It is already the name and already the entry point everywhere. |
| `project-testing` | P4, tdd Layout, flutter-mvu-test pointer, A8 test half | **Keep (required).** It splits cleanly off tdd, which then becomes generic. |
| `project-toolchain` | C1–C5, M1, M5 command | **Keep (required, parameter-shaped).** |
| `project-docs` / `project-index` | D1 | **Optional, and absent by default.** The owner just deleted the only instance. Generic skills should say "if a `project-index` skill exists, recall/record it". |
| `project-planner` (persona) | S1, S3 | **Fold into project-architecture.** Only the stack line and the state vocabulary are project-specific. A separate slot would duplicate architecture. |
| `project-tracker` | R1–R7 | **Drop.** Everything is derive or generic. R7 (merge style) can be one line in toolchain. |
| `project-stack` (flutter-mvu equivalent) | MVU library rules | **Drop as a slot.** It is reached through project-architecture. |
| `project-review` | extra review angles | **Drop for now.** review-simplicity is generic. Revisit if a project wants its own review axis. |
| `project-ui` / design | ui-ticket flow | **Defer.** It depends on whether the ui-* skills join the generic set. |

### Proposed minimal set

| Slot | Class | Required content (the contract seed for #6) | postkarte today |
|---|---|---|---|
| **`project-architecture`** | judgment | Stack line (languages, frameworks, for the planner seat) · module layout and the module-root pattern (for commit scope and "feature") · placement rules · **hard bans** (a list the interview must never offer) · **plan vocabulary**: what the Frontend/state section of a plan must name (postkarte: Model, Events, StateView) · wiring files that are easy to drop (migrations, DI registration) · which further skills to load (flutter-mvu) | project-architecture + flutter-mvu + CLAUDE.md's hard constraint |
| **`project-testing`** | judgment | Test framework mechanics · test file layout and naming convention (if it differs from generic `should X when Y`) · where fakes live · which further skills to load | tdd § Layout + flutter-mvu-test |
| **`project-toolchain`** | parameter | `format`, `analyze` (+ how to tell errors from warnings), `test`, `test <file>` · dependency manifest files and registry, and the acceptance bar for a new dependency (postkarte: pub.dev, Android **and** iOS) · target platforms · optional: merge style | scattered across commit, implement-ticket, plan-ticket, create-ticket, review-simplicity |
| *`project-index`* (optional) | judgment | recall/record for a codebase location index | was feature-docs (deleted) |

What becomes generic and app-shipped: create-ticket, plan-ticket, implement-ticket, commit, **tdd** (minus Layout), **review-simplicity**, **github-issue** (minus slug and domain values). Together with the 3 slots, that covers every coupling row except the artifact rows (X1–X6), which go to the artifact-bridge decision.

## 4. Implications for other tickets

- **#6 (project-skill contract):**
  - Start from the 3 required slots + 1 optional slot above.
  - Decide the format for `project-toolchain`. It is parameter-shaped and the app may want to read it too (for example, to run tests after an AFK stage), so consider a machine-readable block or file rather than prose.
  - Specify chaining: a slot may name further project skills to load.
  - Specify optional-slot semantics (the generic skill checks for presence).
- **#11 (skill sync):**
  - Today's "sync" is manual byte-copying, with postkarte as upstream.
  - Skills live in `.claude/commands/<name>/SKILL.md` in both repos, not `.claude/skills/`.
  - tdd, review-simplicity and github-issue move from project-owned to app-shipped, so sync must handle *taking ownership* of a file a project already has (same name, local edits).
  - Sync should also flag dangling references (like `feature-docs`) and project-local skills that call generic ones (ui-implement-ticket calls review-simplicity and commit).
- **Artifact-bridge ticket:** X1–X5 are the full list to replace. `example-page.html` needs no runtime changes. Its Flutter-specific lanes suggest the lane names should come from `project-architecture`.
- **Onboarding (not yet specified in #1):** label provisioning (`bootstrap-labels.sh`) is generic and belongs to onboarding or the app. Domain labels come from the repo.
- **Quick fixes for whoever rewrites the skills:**
  - commit's `lib/<feature>/` scope bug.
  - Dangling `feature-docs` calls in 4 skills.
  - postkarte issue numbers in plan-ticket.
  - create-ticket's Android/Linux/web vs Android/iOS.
  - The `git stash` step in implement-ticket, which is unsafe once the app runs parallel worktrees.
