# Research: how skills are installed, synced and resolved

Ticket: #5 (map #1). Researched 2026-09-25 against Claude Code **v2.1.282** and the official docs at code.claude.com.

**Short answer:** ship the generic skills as a **plugin** (`aisf`) from a **local-directory marketplace** that the app owns. Each generic skill sets an explicit frontmatter `name:`. Enable the plugin per project at **local scope** (`.claude/settings.local.json`, gitignored). For app-driven sessions, optionally pin it with `--plugin-dir`. Project skills stay plain `.claude/skills/project-*` directories committed in the project repo. Generic skills call them by **bare name** through the Skill tool. That keeps the project's files and the app's files apart and survives worktrees. It also gives a clean "project overrides plugin default" rule, which I verified by experiment.

Legend: **[V]** = verified by a local experiment in a scratch repo. **[D]** = taken from the docs, not tested here.

---

## 1. Where skills load from, and precedence

### Load locations [D]
From [skills: Choose where skills load](https://code.claude.com/docs/en/skills#where-skills-live):

| Location | Path | Command name |
|---|---|---|
| Enterprise | `<managed dir>/.claude/skills/<name>/SKILL.md` | `/<name>` |
| Personal | `~/.claude/skills/<name>/SKILL.md` | `/<name>` |
| Project | `.claude/skills/<name>/SKILL.md`, searched from cwd up to the repo root (or the worktree root) | `/<name>` (directory name, not the `name:` field) |
| Nested | `<subdir>/.claude/skills/...`, loaded lazily once Claude touches files there | `/<subdir>:<name>` on a clash |
| `--add-dir` | `.claude/skills` (plus `commands`/`agents`) of the added dir | `/<name>` |
| Legacy commands | `.claude/commands/<name>.md` (subdirs become `/<dir>:<name>`) | `/<name>` |
| Plugin | `<plugin>/skills/<name>/SKILL.md` | `/<plugin>:<name>`, and the bare `/<name>` too when no other command owns it (see below) |
| claude.ai synced | `~/.claude/skills/synced/` | `/anthropic-skills:<name>` |

### Collision rules [D], with checks marked [V]
From [skills: Resolve skills that share a name](https://code.claude.com/docs/en/skills#resolve-skills-that-share-a-name):

- **Enterprise > personal > project.** A personal `~/.claude/skills/deploy` **beats** the project's `deploy`. [D] I didn't test this because it touches the user's home.
- **Skill > `.claude/commands` file of the same name.** [V] `.claude/skills/dup` and `.claude/commands/dup.md` both existed; `/dup` ran the skill, and only one `dup` was listed.
- **A user skill replaces a bundled skill of the same name** (for example `code-review`), but not the bundled aliases. [D]
- **Plugin skill vs any local skill:** both load, because the plugin one is namespaced `/<plugin>:<name>`. [V]
- **Bare name for plugin skills:** the docs say the bare `/<name>` also invokes a plugin skill "unless another command already uses that name". [V] **This only works when the plugin skill sets an explicit `name:` in its frontmatter.** Without one, `/dup` did not resolve and the Skill tool returned `Unknown skill: project-architecture. Did you mean aisf:project-architecture?`. With `name: dup` / `name: project-architecture`, the bare name resolved to the plugin skill. When a project skill of the same name existed, the bare name resolved to the **project** skill instead.
- Plugin vs plugin with the same manifest name: managed > `--plugin-dir`/`--plugin-url` > installed marketplace plugin > skills-dir plugin (personal over project) > claude.ai-synced. [D] [plugins/loading: Name conflicts](https://code.claude.com/docs/en/plugins/loading#name-conflicts)

### Other facts that matter
- **Skill directories under `.claude/commands/` work** (this repo's current layout, `.claude/commands/commit/SKILL.md`). [V] `/foo` ran, and `Skill("foo")` from another skill worked. The init message lists it under `slash_commands` but not `skills`. The docs only describe `.md` files in `commands/`, so moving to `.claude/skills/` (or a plugin) is the documented path.
- **Symlinked skill folders** in the project/personal location load: `.claude/skills/linked-skill -> ../../shared/linked-skill`. [V] The docs add that several links to the same target load once. [D] Plugins copied into the cache handle symlinks differently: links inside the plugin are kept, links elsewhere in the same marketplace are dereferenced, links outside are dropped. [D] ([host-marketplace: symlinks](https://code.claude.com/docs/en/plugins/host-marketplace#share-files-within-a-marketplace-with-symlinks))
- **Live reload:** edits under `~/.claude/skills`, project `.claude/skills` and `--add-dir` skills are picked up mid-session. A new top-level skills dir needs a restart. Plugin changes need `/reload-plugins` or a new session. [D]
- **Trust:** plain project skills **load in a `claude -p` run in an untrusted folder**. [V] A **skills-dir plugin** (`.claude/skills/<x>/.claude-plugin/plugin.json`) is **skipped** until the workspace trust dialog is accepted. [V] `claude plugin list` says so. Project-file `extraKnownMarketplaces` is also ignored in untrusted folders, including `-p`. [D]
- **Worktrees:** a worktree with **no** `.claude/skills` reads through to the main checkout's project skills (v2.1.277+). A worktree **with** its own `.claude/skills` loads **only** that copy. [D] [V] I committed `project-x` and left `generic-y` untracked in main's `.claude/skills`; a new worktree saw only `project-x`. Plugins installed at project **and at local scope** in the main checkout load in its worktrees. [D for project] [V for local]

---

## 2. Can an app write, symlink or install into a project?

### Option A: write/copy files into `.claude/skills/` (vendoring)
- Reliable and simple. Loads without trust. [V]
- **Committed:** every clone and cloud session gets them, and they show up in diffs. Updates are app-driven rewrites, and they collide with local edits. The app can't tell "project override" from "stale copy".
- **Gitignored:** this breaks in worktrees as soon as the project also commits its own `project-*` skills to `.claude/skills`, because the untracked generic skills don't appear there. [V] AFK runs will very likely use worktrees, so this is disqualifying unless generic and project skills live in different roots.

### Option B: symlink app-owned skill dirs into `.claude/skills/`
- Loads fine. [V] Updating the app's directory updates every project at once.
- It has the same worktree/gitignore problem as A, it breaks if the app moves, and it's awkward on Windows. Not recommended.

### Option C: plugin via a marketplace (recommended)
- Fully scriptable. [V]
  ```bash
  claude plugin marketplace add /path/to/aisf-marketplace      # user scope by default; --scope project|local
  claude plugin install aisf@aisf-marketplace --scope local    # or user / project
  claude plugin update aisf@aisf-marketplace
  claude plugin uninstall aisf@aisf-marketplace --scope local
  claude plugin list            # shows scope + status; --json available on install
  claude plugin validate <dir>  # CI-friendly manifest/frontmatter check
  ```
  `install` takes `--json`, and `-y` or `--accept-command` for `command` sources. Installs apply at the next session start or on `/reload-plugins`. [D] ([discover-plugins: Install from your shell](https://code.claude.com/docs/en/discover-plugins#install-from-your-shell))
- What gets written [V]:
  - `--scope project` writes the **absolute local path** into the committed `.claude/settings.json`: `extraKnownMarketplaces: {"aisf-market": {"source": {"source": "directory", "path": "/tmp/aisf-market"}}}` plus `enabledPlugins`. That path is machine-specific and **shouldn't be committed** for a local marketplace.
  - `--scope local` writes only `enabledPlugins` to `.claude/settings.local.json` (gitignored). The marketplace registration goes in user settings, and the install record goes in `~/.claude/plugins/installed_plugins.json` (with `projectPath`).
- **Loaded in place:** a relative-path plugin inside a local-directory marketplace loads straight from the source dir (`path: /tmp/aisf-market/plugins/aisf` in the init message). [V] Its version shows as `unknown`, and it picks up source edits at each session start with no version bump needed. [D] ([plugins/loading: In-place and copied plugins](https://code.claude.com/docs/en/plugins/loading#in-place-and-copied-plugins)) So **"sync" becomes "the app updates its own marketplace dir"**.
- A git-hosted marketplace is also possible: `owner/repo#ref` or `https://…git#ref`, with plugin entries pinnable by `ref` plus a 40-char `sha`. That source gets copied into `~/.claude/plugins/cache/<mkt>/<plugin>/<version>/`, and the version is the manifest `version`, else the entry `version`, else the commit SHA. [D] ([marketplace-reference](https://code.claude.com/docs/en/plugins/marketplace-reference), [plugins/loading: Versions and updates](https://code.claude.com/docs/en/plugins/loading#versions-and-updates)) Auto-update is **off** by default for third-party marketplaces, and `autoUpdate: true` on the `extraKnownMarketplaces` entry turns it on. [D]
- **Enabled in project settings but not installed:** a committed `enabledPlugins` alone does **not** fetch an external-source plugin onto a new machine; only a relative-path/seed plugin works without an install record. [D]
- Cloud sessions and routines don't load plugins from repo or user settings. [D] That's irrelevant for a local-only v1.

### Option D: session-only `--plugin-dir` (or SDK `plugins: [{type: "local", path}]`)
- Nothing is written to the project or to user settings. `--plugin-dir` **beats** an installed marketplace plugin with the same manifest name. [D] [V] It loaded, and namespacing and bare-name resolution behaved the same as an installed plugin.
- Perfect for the app's own AFK runs, because it gives exact per-run pinning: point at `<app>/skills/aisf@<version>`. Interactive sessions the human starts outside the app don't see it, so combine it with C.
- The Agent SDK has the same option: `plugins: [{type: "local", path}]`, with skills invoked as `/<plugin>:<skill>`. [D] ([agent-sdk/plugins](https://code.claude.com/docs/en/agent-sdk/plugins))

### Option E: skills-dir plugin in the project's `.claude/skills/<x>/.claude-plugin/plugin.json`
- It needs workspace trust and is skipped in untrusted `-p` runs. [V] It only loads from the primary working directory, with no parent search. [D] Not recommended.

---

## 3. Skill-to-skill invocation

- **Mechanism:** a skill's body tells Claude to call the **Skill tool** with a name, for example `Skill("project-architecture")`. There is no deterministic, non-model call path: skill chaining is always the model following instructions. The deterministic entry point is a user or app sending `/<name>` as the prompt (for example `claude -p "/aisf:implement-ticket 42"`). [V]
- **Resolution** [V]:
  - The Skill tool resolves a bare name to local skills (project/personal) first.
  - It falls back to a plugin skill **only when that plugin skill declares `name: <bare>`**.
  - A namespaced name (`aisf:x`) always hits the plugin.
  - A plugin skill calling `project-architecture` got the **project's** skill when one existed, and the plugin's default when not.
- **`disable-model-invocation: true`** [V]:
  - The skill still runs when sent as the prompt (`claude -p "/caller"` worked).
  - A `Skill(...)` call to it from another skill fails with: `Skill manual-only cannot be used with Skill tool due to disable-model-invocation. Ask the user to run /manual-only themselves … Do not replicate this skill's workflow by other means`.
  - Its description is also removed from Claude's context, and it can't be preloaded into subagents. [D]
  - **Consequence:** any skill another skill chains to, such as `commit` (called by implement-ticket) or `project-*`, **must not** set it. Entry-point skills (plan-ticket, wayfinder) can.
- **`user-invocable: false`** hides a skill from the `/` menu, but Claude can still invoke it. [V] `project-architecture` with this flag was invoked fine via the Skill tool. This is a good default for convention-named project skills.
- **Missing target** [V]:
  - The tool returns `<tool_use_error>Unknown skill: project-testing</tool_use_error>` (is_error) and the turn continues. The model decides what to do next: it reported and stopped when told to.
  - When only a namespaced variant exists, the error adds `Did you mean aisf:<x>? Invoke it by that full name.` and the model retried with it.
  - The generic skills therefore **must spell out the missing-skill behavior**: stop and report, or fall back to a default. Otherwise the model may improvise.
- **Permissions:** `Skill(name)` / `Skill(name *)` allow and deny rules exist. `skillOverrides` in settings can hide or disable local skills but **doesn't apply to plugin skills**. [D] ([skills: Restrict Claude's skill access](https://code.claude.com/docs/en/skills#restrict-claudes-skill-access))
- **Context lifecycle:** an invoked skill's content stays in context for the session. After compaction, only the first 5k tokens of each recent skill are re-attached, within a 25k total budget. [D] Long AFK chains that invoke many skills can lose early ones.

---

## 4. Recommendation for AISoftwareFactory

1. **Package the generic skills as one plugin `aisf`** (create-ticket, plan-ticket, implement-ticket, commit, …) inside an **app-owned local-directory marketplace**, for example `~/.aisf/marketplace/` (a git checkout of this repo's skills at a release tag).
   - Every generic skill sets `name:` explicitly so its bare name works.
   - Avoid names that clash with bundled skills (`code-review`, `verify`, `run`, `simplify`, `debug`, …).
2. **Onboarding a project (scripted):**
   - `claude plugin marketplace add ~/.aisf/marketplace` (once, user scope).
   - `claude plugin install aisf@aisf --scope local` in the project. This writes only to the gitignored `.claude/settings.local.json`.
   - It works in worktrees. [V]
3. **App-run AFK sessions** additionally pass `--plugin-dir <app>/…/aisf` (or the SDK `plugins` option). That pins the exact version for the run and doesn't depend on trust or install state.
4. **Sync = the app updates its marketplace dir** (git fetch plus checkout of a tag). In-place loading means the next session gets the new version without `claude plugin update`. Per-project pinning, if ever needed, means one plugin dir per version passed with `--plugin-dir`.
5. **Project skills stay plain, committed `.claude/skills/project-<topic>/SKILL.md`** in the project repo, with `user-invocable: false`.
   - Generic skills invoke them by **bare name**.
   - The plugin may ship **fallback defaults** with the same `name:`, and the project copy shadows them automatically. [V]
6. **Overriding a generic skill:** a project can shadow `/plan-ticket` with its own `.claude/skills/plan-ticket`. The bare name then goes to the project, and `/aisf:plan-ticket` stays reachable. Generic skills should therefore call **siblings by bare name** (`commit`, not `aisf:commit`) when overriding is wanted, and by namespaced name when it isn't.
7. **Frontmatter rules for the generic set:**
   - No `disable-model-invocation` on anything that's chained.
   - Every cross-skill call names the skill in backticks and says "call the Skill tool with …".
   - Every call to a project skill states what to do if it's `Unknown`.
8. **Migrate this repo's `.claude/commands/<name>/SKILL.md` layout to a plugin `skills/` dir.** Skill dirs under `commands/` work but aren't documented.

## 5. Open risks
- **Personal skills beat project skills.** A user's `~/.claude/skills/project-architecture` (or `commit`) would silently shadow the project's copy and the plugin default. The app could detect and warn about this.
- **Bare-name resolution to plugin skills** relies on the `name:` field behavior I observed on v2.1.282. The docs changed around v2.1.216–2.1.246, so it may shift again. Pin a minimum Claude Code version and add a smoke test (`claude -p` with a probe skill, like the experiments here).
- **Skill chaining is model-driven.** A cheap model (for example `model: haiku` on `commit`) or a long context can skip or improvise steps. Critical gates belong in the app or in hooks, not in skill prose.
- **A local-directory marketplace path is absolute** and recorded in user settings. Moving the app's data dir means re-registering the marketplace.
- **Undocumented:** skill dirs under `.claude/commands/`, and `--plugin-dir` precedence over a *local*-scope install (the docs only cover marketplace installs generally). Both are verified here only on this version.
- **Compaction budget** (5k per skill, 25k total) may truncate long generic skills like plan-ticket (about 300 lines) in long AFK sessions.

## Experiments (reproducible)
The scratch repos were `/tmp/skilltest*`, `/tmp/wt-main`, and a marketplace at `/tmp/aisf-market` with `plugins/aisf/{.claude-plugin/plugin.json, skills/{dup,plan-ticket,project-architecture}}`. Each run was `claude -p "<prompt>" --model haiku --output-format stream-json --verbose`, and I read the `init` message (`skills`, `slash_commands`, `plugins`) and the Skill `tool_use`/`tool_result` pairs. All test installs, marketplaces and cache dirs were removed afterwards.

## Sources
- Skills: https://code.claude.com/docs/en/skills
- Plugin loading reference (scopes, precedence, in-place vs cached, versions, name conflicts): https://code.claude.com/docs/en/plugins/loading
- Install and manage plugins (scopes, shell install, marketplace sources, `#ref`): https://code.claude.com/docs/en/discover-plugins
- Plugins overview: https://code.claude.com/docs/en/plugins/overview
- Create plugins (skills-dir plugins, `claude plugin init`): https://code.claude.com/docs/en/plugins/create
- Marketplace reference (`ref`/`sha` pinning, source types): https://code.claude.com/docs/en/plugins/marketplace-reference
- Host a marketplace (symlinks, auto-update): https://code.claude.com/docs/en/plugins/host-marketplace
- Settings reference (`extraKnownMarketplaces`, `enabledPlugins`): https://code.claude.com/docs/en/settings-reference
- Worktrees (what worktrees share): https://code.claude.com/docs/en/worktrees#what-worktrees-share-with-the-main-checkout
- Agent SDK plugins: https://code.claude.com/docs/en/agent-sdk/plugins
- Local: `claude --help`, `claude plugin --help`, `claude plugin install --help`, `claude plugin marketplace add --help` (v2.1.282)
