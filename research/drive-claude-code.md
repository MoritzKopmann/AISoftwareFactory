# Research: how a local server can drive Claude Code sessions

Ticket: [#2](https://github.com/MoritzKopmann/AISoftwareFactory/issues/2) (map: [#1](https://github.com/MoritzKopmann/AISoftwareFactory/issues/1))
Date: 2026-09-25. Versions checked: Claude Code CLI 2.1.282, `@anthropic-ai/claude-agent-sdk` 0.3.282 (bundles CLI 2.1.282), Python `claude-agent-sdk` 0.2.159 (bundles CLI 2.1.281).

## Answer in one paragraph

Use the **TypeScript Claude Agent SDK** in **streaming input mode**, with one long-lived `query()` per session. The prompt is an `AsyncIterable<SDKUserMessage>` that the server keeps open and pushes into. Artifact clicks become new `SDKUserMessage`s pushed onto that iterable (or `streamInput()`). **Injecting into a running session works.** A message sent while a turn is running is queued, then picked up at the next tool-call boundary *inside the same turn*. It is not held until the turn ends. A spike confirmed this (see below). Both SDKs and raw `claude -p --input-format stream-json` are the same thing underneath: the SDK spawns the `claude` CLI and speaks the stream-json/control protocol over stdio. So the choice is about ergonomics and typed control methods, not capability. TypeScript has the fullest control surface and the best docs, and it matches a Node web server.

## How it works underneath

All three programmatic options run the same engine:

```
web server ──stdio (NDJSON: user msgs + control_request/response)──▶ claude CLI subprocess ──▶ Anthropic API
                                                                      │ owns cwd, tools, hooks, skills,
                                                                      │ JSONL transcript (~/.claude/projects/…)
```

- Agent SDK docs: "When your code calls `query()`, the SDK spawns a separate `claude` CLI process and talks to it over stdio." There is one subprocess per session, so N concurrent sessions means N subprocesses.
- Raw `claude -p --input-format stream-json --output-format stream-json` is that same protocol without the SDK's typed wrapper. You would have to re-implement the control protocol yourself: `control_request` for permission prompts, interrupts, and mode changes.

## Comparison

| Need (ticket bullet) | TS Agent SDK (`@anthropic-ai/claude-agent-sdk`) | Python Agent SDK (`claude-agent-sdk`) | Headless `claude -p` + stream-json I/O | Others (interactive CLI + channels / Remote Control / `--bg`) |
|---|---|---|---|---|
| **Start in repo/worktree with a skill/command** | `query({prompt, options:{cwd, …}})`; send `"/implement-ticket 42"` as the first user message. `projectConfigRoot` (CLI ≥ 2.1.275) reads `.claude/` config from the main checkout while `cwd` is a worktree. | `ClaudeAgentOptions(cwd=…)` + `client.query("/implement-ticket 42")` | `cd <worktree> && claude -p … ` with first stdin line `/implement-ticket 42`. `-w/--worktree` can create a worktree. User-invoked skills and custom commands work in `-p`. | Interactive: human types it. `--bg` starts a background session. |
| **Stream output + tool activity live** | Async iterator of typed `SDKMessage`s: `assistant` (text/tool_use), `user` (tool_result), `system/*` (init, task_*, api_retry, hook events), `result`. `includePartialMessages` adds token deltas. `forwardSubagentText` adds subagent transcripts. | Same messages as dataclasses via `receive_messages()` / `receive_response()`. `include_partial_messages`. | NDJSON on stdout, same schema. Use `--verbose`, `--include-partial-messages`, `--forward-subagent-text`, `--include-hook-events`. | Terminal only (a TUI, not machine-readable). |
| **Inject a new user message into a running session** | **Yes.** Yield more `SDKUserMessage`s from the prompt iterable, or `query.streamInput(iter)`. Picked up between tool calls mid-turn (see spike). Set `uuid` to correlate: `result.user_message_uuids` lists every message the turn answered. `shouldQuery:false` appends context without starting a turn. `interrupt()` returns a receipt with `still_queued`. | **Yes.** `client.query(msg)` just writes a stdin line and can be called at any time. The caveat is the reader side: `receive_response()` stops at the first `result`, so use one `receive_messages()` loop per session. | **Yes.** Write another `{"type":"user",…}` line to stdin. `--replay-user-messages` echoes it back as an ack (`isReplay:true`). | Channels (research preview) push MCP-server events into an *interactive* session. That requires a claude.ai/Console login, has an unstable contract, and needs plugins. Remote Control and cross-session messaging are for humans and peer sessions. None is meant as a server API. |
| **Permissions for AFK + surfacing approvals** | `permissionMode` (`default`, `acceptEdits`, `plan`, `dontAsk`, `bypassPermissions`, `auto`), `allowedTools`/`disallowedTools` (rule syntax such as `Bash(git *)`), programmatic `hooks` (PreToolUse can allow/deny/modify/**defer**), and a **`canUseTool` async callback** that receives unresolved prompts *and* `AskUserQuestion` (can be held open until a human answers in the UI). `permissionPrompts:'none'` makes the run fully unattended. `setPermissionMode()` changes the mode mid-session. | Same: `permission_mode`, `allowed_tools`, `hooks`, `can_use_tool`, `set_permission_mode()`. | Same flags (`--permission-mode`, `--allowedTools`, `--permission-prompts none`). Approval goes through `--permission-prompt-tool <mcp tool>` or the raw `control_request` protocol. Denials are reported as `permission_denied` system messages and `result.permission_denials`. | Human at a terminal. `PermissionRequest`/`Notification` hooks can notify. |
| **Resume/continue later; several at once** | `resume: sessionId`, `continue`, `forkSession`, `sessionId` (choose your own UUID up front), `persistSession`. `listSessions()`/`getSessionMessages()` read transcripts. One subprocess per session gives real parallelism, bounded by RAM (docs suggest ~1 GiB per agent as a starting point). `startup()` pre-warms. | `resume`, `continue_conversation`, `fork_session`. `ClaudeSDKClient` per session. | `--resume <id>`, `--continue`, `--fork-session`, `--session-id <uuid>`. One process per session. | `claude --resume`, `--bg` + `claude attach`. |
| **Load project skills (`.claude/skills` vs `.claude/commands`)** | By default loads user + project + local setting sources, so `<cwd>/.claude/skills/*/SKILL.md` **and** legacy `.claude/commands/*.md` are both discovered and dispatchable as `/<name>`. `skills` option restricts *model* invocation, not `/name` dispatch. `system/init` lists `slash_commands` and `skills`. `plugins` option loads a plugin dir. `reloadSkills()` re-reads skills mid-session. | Same (`setting_sources`, `skills`, `plugins`). | Same discovery without `--bare`. **`--bare` skips skill and command auto-discovery** (only `--add-dir` skills load, and `.claude/commands` never does). | Same discovery. |
| Typed control surface | Richest: `interrupt`, `setPermissionMode`, `setModel`, `stopTask`, `backgroundTasks`, `rewindFiles`, `supportedCommands`, `mcpServerStatus`, `setMcpServers`, `reloadSkills`, `close`… | Good subset: `interrupt`, `set_permission_mode`, `set_model`, `rewind_files`, `stop_task`, MCP status/toggle, `disconnect`. | None. You write `control_request` JSON yourself (documented only indirectly). | n/a |
| In-process custom tools | `createSdkMcpServer` + `tool()`: tools run inside the server process. | `@tool` + `create_sdk_mcp_server`. | External MCP server via `--mcp-config` only. | MCP config. |
| Install | npm. Bundles a native CLI per platform (optional deps). No separate `claude` install needed. | pip wheel with bundled CLI. | Requires installed `claude`. | CLI. |

## Spike: mid-turn injection (settled by experiment)

Script: [`research/spikes/inject-mid-turn.sh`](spikes/inject-mid-turn.sh). It runs raw `claude -p --input-format stream-json --output-format stream-json --replay-user-messages`, CLI 2.1.282, model haiku, with the steps below.

1. t=0: user message A (`uuid 1111…`): "Run `sleep 12 && echo done`, then report."
2. t=5 s, while the Bash call is still sleeping: user message B (`uuid 2222…`): "also tell me the secret word PINEAPPLE".

Observed stream, condensed:

```
user(replay) 1111…  → assistant tool_use Bash(sleep 12…) → user tool_result "done"
user(replay) 2222…  ← B picked up right after the tool result, before the next model call
assistant: "The command completed successfully and output `done`. By the way, the secret word is PINEAPPLE."
result success, num_turns 2, user_message_uuid 1111…, user_message_uuids [1111…, 2222…]   ← ONE result
```

Result: an injected message does not interrupt a running tool call. It is delivered at the next tool-call boundary and folded into the current turn, and a single `result` answers both. The docs describe the same behavior: "If Claude Code picks up a regular message of yours between tool calls, the turn answers the picked-up message from then on", and "When you send several messages close together, Claude Code can merge them into one turn". If the session is idle, the message starts a new turn. To preempt a long tool call, call `interrupt()` first. The SDK uses the same CLI and protocol, so the result carries over.

## Recommendation

1. **Engine:** a Node/TypeScript server using `@anthropic-ai/claude-agent-sdk`, with one `query()` in streaming input mode per AFK run. Keep a per-session async queue that backs the prompt iterable. Treat the session as long-lived: it stays open until the skill finishes and the server closes the iterable (or calls `close()`).
2. **Start a stage:** `sessionId` = a UUID the server generates and stores against the ticket. Set `cwd` to the ticket's worktree and `projectConfigRoot` to the main checkout. The first message is `/implement-ticket 42`. Leave `settingSources` at its default, or pass `['project']` plus explicit settings, so the synced project skills load. **Don't use `--bare`/`settingSources: []`**, because that hides the skills.
3. **Artifact bridge (#8):** an artifact click becomes an HTTP POST to the server, which pushes `{type:'user', uuid, message:{role:'user', content:<structured text/JSON>}}` onto that session's queue. Correlate using `uuid` and `result.user_message_uuids`. Use `shouldQuery:false` for background context that shouldn't trigger a reply. If the skill must block waiting for a click, prefer a **custom in-process tool** (for example `await_artifact_input`, built with `createSdkMcpServer`) or `AskUserQuestion` through `canUseTool`. Claude then explicitly waits and the answer comes back as a tool result, rather than relying on "the next user message".
4. **AFK permissions (#10):** baseline `permissionMode: 'acceptEdits'` (or `auto` if available on the account), a curated `allowedTools` list, scoped `disallowedTools`, and a `PreToolUse` hook as the single policy choke point (it sees every call, even ones auto-approved). Put `canUseTool` in HITL runs to route approvals and `AskUserQuestion` into the UI inbox. In pure AFK runs, set `permissionPrompts: 'none'` so nothing blocks forever, or use the hook's `defer` to park the run with `stop_reason: 'tool_deferred'` and resume it after approval.
5. **Resume/parallel (#9):** store `session_id` per ticket/stage and resume with `resume`. Run stages in parallel as separate subprocesses in separate worktrees, bounded by a concurrency limit in the server.
6. Python is a valid fallback with the same capabilities. Raw `claude -p` is only worth it if the server isn't JS/Python, because you would re-implement the control protocol.

## Open risks

- **Auth / terms.** The SDK overview says third-party *products* may not offer claude.ai login or rate limits and should use API keys. A personal local tool that runs your own logged-in CLI (as the spike did) looks like the same use as the CLI itself, but #9 should decide explicitly: API key (`ANTHROPIC_API_KEY`) vs. the user's Claude subscription login. Distributing the app to others would push it toward API keys.
- **Mid-turn pickup timing** depends on tool-call boundaries. A click during a long Bash call waits until the call finishes, and a click during a final text answer starts the next turn. The UI should show messages as "queued → picked up" using replays and `user_message_uuids`.
- **Message merging.** Several quick clicks can merge into one turn. Artifact payloads should be self-describing (type, artifact id, field values) so merged messages stay unambiguous.
- **Protocol churn.** Many relevant fields are recent (`user_message_uuids` SDK ≥ 0.3.259, `permissionPrompts` CLI ≥ 2.1.259, `projectConfigRoot` ≥ 2.1.275, interrupt receipt capabilities). Pin the SDK version and feature-detect via `system/init.capabilities`.
- **`-p`/SDK trust model.** There is no workspace-trust dialog, so project hooks and `.mcp.json` servers in a managed repo run automatically. The app must only manage repos the user trusts.
- **Long-lived processes.** Memory grows with session length. A process crash loses the in-flight turn, but the transcript persists, so recovery means resuming by `session_id`. SIGTERM leaves the turn unfinished, and resume continues it. This feeds into "Failure and recovery" in #1.
- **Channels** looked like a direct "push into a running session" feature, but they are a research preview, target interactive sessions, and need plugins and org enablement. Not recommended for v1.
- The Python docs' "drain `receive_response()` before the next query" guidance is about *reading* responses, not about being unable to send. Anyone choosing Python should use a single `receive_messages()` reader per session.

## Sources

- Streaming vs single input mode: https://code.claude.com/docs/en/agent-sdk/streaming-vs-single-mode
- TypeScript SDK reference (Query methods, Options, `SDKUserMessage` `uuid`/`shouldQuery`/`priority`, `user_message_uuids`, interrupt receipt, `projectConfigRoot`): https://code.claude.com/docs/en/agent-sdk/typescript
- Python SDK reference (`ClaudeSDKClient`): https://code.claude.com/docs/en/agent-sdk/python
- Headless / `claude -p` (stream-json, `--permission-prompts`, skills in `-p`, `--bare`, resume): https://code.claude.com/docs/en/headless
- CLI reference (`--input-format`, `--replay-user-messages`, `--permission-prompt-tool`, `--max-turns` with queued messages): https://code.claude.com/docs/en/cli-reference
- Permissions evaluation order and modes: https://code.claude.com/docs/en/agent-sdk/permissions
- Approvals and user input (`canUseTool`, `AskUserQuestion`): https://code.claude.com/docs/en/agent-sdk/user-input
- Sessions (resume/continue/fork): https://code.claude.com/docs/en/agent-sdk/sessions
- Skills and commands in the SDK: https://code.claude.com/docs/en/agent-sdk/skills
- Agent loop (queued messages vs max turns): https://code.claude.com/docs/en/agent-sdk/agent-loop
- Hosting (subprocess model, concurrency, `streamInput`/`startup`): https://code.claude.com/docs/en/agent-sdk/hosting
- SDK overview (auth note): https://code.claude.com/docs/en/agent-sdk/overview
- Channels: https://code.claude.com/docs/en/channels
- Packages: https://www.npmjs.com/package/@anthropic-ai/claude-agent-sdk, https://pypi.org/project/claude-agent-sdk/
- Local: `claude --help` (v2.1.282); installed SDK typings `sdk.d.ts` (`SDKUserMessage.priority?: 'now'|'next'|'later'`, undocumented); Python `client.py` `query()` writes directly to stdin.
