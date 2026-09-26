# Research: subscription auth and usage-limit signals for SDK sessions

Ticket: [#17](https://github.com/MoritzKopmann/AISoftwareFactory/issues/17), for [#10](https://github.com/MoritzKopmann/AISoftwareFactory/issues/10) (pause all work on a usage limit, resume after the reset) and the open risk in [#2](https://github.com/MoritzKopmann/AISoftwareFactory/issues/2).

Researched 2026-09-26 against Claude Code **v2.1.283** and `@anthropic-ai/claude-agent-sdk` **0.3.283** (TypeScript), logged in with a claude.ai **Pro** account. Sources: the SDK's `sdk.d.ts`, strings from the CLI binary, one small live probe (a one-word Haiku turn), and Anthropic docs.

Legend: **[verified]** = seen live or stated in types/docs. **[code]** = read from the minified CLI bundle, not seen live. **[unverified]** = inferred.

## TL;DR

- **Auth works with no API key.** The SDK spawns the unmodified `claude` binary, which uses the human's own `claude /login` credentials. **[verified]**
- **It's allowed for aisf with conditions.** You use your own login, the app never touches tokens, and nobody else's traffic goes through it. The docs ban *offering* claude.ai login to *other* users. A planned change that would have split SDK usage off the plan limits is **paused**, so SDK runs draw from the same 5-hour and weekly limits as interactive Claude Code.
- **Usage signals are good.** Every API call emits `rate_limit_event` with status, window, utilization and `resetsAt`. `Query.usage_EXPERIMENTAL_…()` gives the full `/usage` numbers on demand. **[verified]**
- **A limit mid-turn ends the turn. It doesn't wait.** The CLI doesn't retry a usage-limit 429 for subscribers. The turn ends with an assistant message (`error: 'rate_limit'`, text starting "You've hit your …") and then `result` with `subtype: 'success'`, `is_error: true`, `api_error_status: 429`. **[code]** The streaming `query()` process stays alive.
- **Resuming works.** After the reset, push a new user message ("continue") into the same live `query()`, or start a new `query({ resume: sessionId })` if the process is gone. **[verified mechanism, unverified end-to-end after a real limit]**

## (a) Subscription login with the Agent SDK

**Technically: yes.** With `ANTHROPIC_API_KEY` removed from the environment, the probe got:

```
accountInfo {"subscriptionType":"Claude Pro","apiProvider":"firstParty", ...}
init apiKeySource none
```

`claude auth status` reports `"authMethod": "claude.ai"`. `Query.accountInfo()` (`AccountInfo.subscriptionType`, `tokenSource`, `apiKeySource`) and the `init` message's `apiKeySource` show which auth a run is using. An app can check this at startup and refuse to run on an unexpected API key, or warn about it. Note: if `ANTHROPIC_API_KEY` is set in the environment, it wins and runs are billed to the API. The Runner should strip it, or pass `env` explicitly.

**Policy.** The relevant text:

- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview), note: *"Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK."*
- [Legal and compliance → Authentication and credential use](https://code.claude.com/docs/en/legal-and-compliance): *"Developers building products or services … including those using the Agent SDK, should use API key authentication … Anthropic does not permit third-party developers to offer Claude.ai login into their own applications, or to route requests through Free, Pro, or Max plan credentials on behalf of their users. Moreover, developers may not collect, store, or intermediate Claude.ai credentials or session tokens."* The same page also says: *"Advertised usage limits for Pro and Max plans assume ordinary, individual usage of Claude Code and the Agent SDK"*, and it doesn't prevent *"an end user from signing in to the unmodified Claude Code binary with their own Claude subscription"*.
- [Help Center: Use the Claude Agent SDK with your Claude plan](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan): a plan to give Pro/Max/Team/Enterprise a separate monthly Agent SDK credit from 2026-06-15 (Pro $20, Max 5x $100, Max 20x $200), with SDK usage no longer counting toward plan limits, is **paused**: *"For now, nothing has changed: Claude Agent SDK, `claude -p`, and third-party app usage still draw from your subscription's usage limits."* The article describes "Claude Agent SDK usage in your own projects" as a normal use of a plan.

**Reading for aisf.** A local, single-user tool that runs the unmodified binary on the owner's own login, for the owner's own repos, fits "ordinary, individual usage of … the Agent SDK". It is not "offering claude.ai login" to third parties. It stays inside the rules only if:

1. aisf never implements its own sign-in, and never reads, stores or forwards OAuth tokens. The user runs `claude /login` (or `claude auth login`) themselves, and aisf only reads status.
2. aisf is never offered as a hosted or multi-user service on someone's plan. This matches the map's "Out of scope".
3. If aisf is ever published as an npm CLI for *other* people, each user signs in with their own subscription through Claude Code's own flow. That is still grey under the "third party developers … offer claude.ai login" wording. **[unverified]**: ask Anthropic before publicly distributing aisf with subscription auth as the default, and support `ANTHROPIC_API_KEY` as the alternative.

Risk: long unattended AFK runs stretch "ordinary, individual usage". Anthropic *"may take measures to enforce these restrictions … without prior notice"*. The pause-on-limit behaviour from #10 is the right mitigation. Consider also a user-set ceiling (e.g. stop starting runs above X % of the weekly window).

## (b) Signals for current usage, limit reached and reset time

### 1. `rate_limit_event` (push, every API response) **[verified]**

Type `SDKRateLimitEvent` → `rate_limit_info: SDKRateLimitInfo`:

| field | meaning |
|---|---|
| `status` | `'allowed' \| 'allowed_warning' \| 'rejected'`. `rejected` means the limit is hit |
| `rateLimitType` | `'five_hour' \| 'seven_day' \| 'seven_day_opus' \| 'seven_day_sonnet' \| 'seven_day_overage_included' \| 'overage'`: the binding window |
| `resetsAt` | Unix **seconds** when that window resets |
| `utilization` | typed as optional. Live it was absent at top level and appeared in `unifiedWindows` as a **fraction 0–1** |
| `overageStatus`, `overageResetsAt`, `overageDisabledReason`, `isUsingOverage` | extra-usage (paid overflow) state |
| `surpassedThreshold` | set when a warning threshold was crossed |

Live sample from the probe (Pro, one Haiku turn; `unifiedWindows` isn't in the `.d.ts` but was on the wire):

```json
{"status":"allowed","resetsAt":1790445600,"rateLimitType":"five_hour",
 "overageStatus":"rejected","overageDisabledReason":"org_level_disabled","isUsingOverage":false,
 "unifiedWindows":{"five_hour":{"utilization":0.11,"resetsAt":1790445600},
                   "seven_day":{"utilization":0.61,"resetsAt":1790499600}}}
```

It is emitted once or more per API call ("emitted when rate limit info changes"). It is derived from `anthropic-ratelimit-unified-*` response headers (`-status`, `-reset`, `-5h-reset`, `-7d-reset`, `-overage-*`) **[code]**. It only exists for claude.ai subscription auth. It is useful as a live meter, but only while a session is running. Code comment **[code]**: *"A refused request's 429 is not read … so while requests are refused the last value persists: still expire any UI derived from this field via resetsAt."* So the UI should expire the stored value at `resetsAt` itself.

### 2. `Query.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET({ skipBehaviors: true })` (pull) **[verified]**

This returns the data behind `/usage` (`SDKControlGetUsageResponse`): `subscription_type`, `rate_limits_available`, and `rate_limits.{five_hour, seven_day, seven_day_opus, seven_day_sonnet, model_scoped[], extra_usage}`, each with `utilization` (**percent 0–100**) and `resets_at` (ISO 8601). Live it also returned undocumented extras: a `limits[]` array (`kind`, `percent`, `severity`, `resets_at`, `is_active`), `spend`, and `seven_day_breakdown` (Claude Code 89 % / Chats 11 %). The comments say it reads "the claude.ai usage endpoint". It is explicitly unstable: the name will change and the shape may change. It needs a live `Query`, so aisf would keep one idle "meter" query, or call it on the current run. `rate_limits_available: false` means API key or 3P auth, where plan limits don't apply.

Note that the usage covers the **whole account**, including chat on claude.ai and hand-run Claude Code, not only aisf's runs.

### 3. Other signals

- `SDKAssistantMessage.error === 'rate_limit'` and `SDKAPIRetryMessage` (`system/api_retry`, `error: 'rate_limit'`, `error_status: 429`, `retry_delay_ms`). `api_retry` shows up for *transient* 429/529 retries, not normally for the plan limit (see (c)).
- `USAGE_LIMIT_ERROR_PREFIXES` (exported, `@alpha`): the text prefixes that mean "a usage limit was genuinely reached" (`"You've hit your"`, `"You've reached your"`, …). `USAGE_WARNING_PREFIXES` (`"You've used"`, `"You're close to"`) are footer/toast only and never arrive as errors.
- Assistant message `usage_report` (`SDKUsageReport`) is attached when `/usage` is run as a slash command in a session.
- CLI: `/usage` (interactive dialog, same data), `/status`, `claude auth status` (JSON: `authMethod`, `subscriptionType`; no usage numbers). There's no public, documented REST endpoint. The claude.ai usage endpoint the CLI calls is internal. Don't call it directly, since that would mean handling OAuth tokens (see (a)).

## (c) What happens when a session hits the limit mid-turn

From the CLI's retry loop (v2.1.283, **[code]**):

- The retry decision for an API error returns `!isSubscriber || … || rOt(e)` for `status === 429`, where `rOt` is only true for a 429 **without** unified-limit markers (a transient rate limit). A plan-limit 429 (`anthropic-ratelimit-unified-status: rejected`) is therefore **not retried**. No wait, no backoff.
- The error becomes a synthetic assistant message (`isApiErrorMessage`) with `error: 'rate_limit'` and text like "You've hit your limit · resets 6pm". Then the turn's `result` is written as **`subtype: 'success'`, `is_error: true`, `api_error_status: 429`**, `result` = that text (`terminal_reason` is probably `'api_error'`, **[unverified]**). It is *not* one of the `error_*` subtypes. Detect it by `is_error && api_error_status === 429`, or by the text matching `USAGE_LIMIT_ERROR_PREFIXES`, together with the last `rate_limit_event.status === 'rejected'` and its `resetsAt`.
- If the limit hits between tool calls, the tool results already written stay in the transcript. The turn just stops at the next model request. Files changed so far stay on disk in the worktree.
- In **streaming input mode** (#2's design) the `query()` and CLI process **stay alive** after that result and wait for the next user message. In single-shot mode, `query()` throws after yielding the error result.
- There is an undocumented env var **`CLAUDE_CODE_RETRY_WATCHDOG=1`** (the self-hosted remote runner sets it). With it, a `rejected` 429 is retried *after sleeping until `anthropic-ratelimit-unified-reset`* (capped at 6 h per wait, heartbeats every 30 s, `api_retry` messages emitted, `onQuotaWindowWait` hook). That is an in-CLI "wait for reset" mode. It's internal and undocumented, so **don't rely on it**. aisf should own the pause/resume logic. **[code]**

Not tested live: hitting the limit on purpose would burn the user's plan.

## (d) Resuming after the reset

- **Same live process (preferred):** after `resetsAt`, push a user message such as "The usage limit has reset. Continue where you stopped." into the session's input stream. The transcript already holds everything up to the failed request. (The #2 spike confirmed mid-session sends are picked up.)
- **Process gone (app restart, crash):** `query({ prompt, options: { resume: sessionId, cwd: <worktree> } })`. Transcripts live in `~/.claude/projects/<encoded-cwd>/<id>.jsonl`, and since v2.1.223 resume finds IDs across directories ([sessions docs](https://code.claude.com/docs/en/agent-sdk/sessions)). The docs list "recover from a limit" as a resume use case (for `error_max_turns` / `error_max_budget_usd`). Nothing in the code suggests a 429-ended transcript is special: the API-error message is kept in the transcript and filtered from what's sent to the model (`isApiErrorMessage`). **[unverified end-to-end]**: confirm on the first real limit hit.
- Resuming *before* the reset just produces another 429 result right away, which is cheap and harmless. So the app can resume at `resetsAt` + a small margin and treat an immediate re-reject as "still limited".

## Recommendations for aisf (input to #10 and the Runner)

1. **Auth pre-flight:** at startup, `claude auth status`. At run start, check `init.apiKeySource === 'none'` / `accountInfo().subscriptionType`. Strip `ANTHROPIC_API_KEY` from run env unless the user opts into API billing. Never handle tokens.
2. **Usage meter:** keep the latest `rate_limit_event` per window in `aisf.db`, expire it at `resetsAt`, and show `five_hour` / `seven_day` utilization and reset in the UI. Refresh on demand with `usage_EXPERIMENTAL…({ skipBehaviors: true })`, behind a tiny adapter, since it's unstable.
3. **Limit hit:** on `result.is_error && api_error_status === 429` (or `status: 'rejected'`), mark the run `paused-limit` (not `stuck`), stop the Scheduler from starting any run, keep the live `query()` open, and schedule a wake at `resetsAt` + 1–2 min.
4. **Resume:** send a "continue" message into the live session, or `resume: sessionId` if the process died. On an immediate re-reject, re-read `resetsAt` and wait again.
5. **Pre-emptive pause (optional):** stop *starting* new runs when `status === 'allowed_warning'` or utilization is above a user threshold, so runs don't die mid-turn.

## Sources

- `@anthropic-ai/claude-agent-sdk@0.3.283` `sdk.d.ts`: `SDKRateLimitEvent`, `SDKRateLimitInfo`, `SDKAPIRetryMessage`, `SDKAssistantMessageError`, `SDKResultSuccess` (`is_error`, `api_error_status`, `terminal_reason`), `TerminalReason`, `Query.usage_EXPERIMENTAL_MAY_CHANGE_DO_NOT_RELY_ON_THIS_API_YET`, `SDKControlGetUsageResponse`, `Query.accountInfo`, `AccountInfo`, `USAGE_LIMIT_ERROR_PREFIXES`, `USAGE_WARNING_PREFIXES`.
- Claude Code v2.1.283 binary (`~/.local/share/claude/versions/2.1.283`), strings: API retry loop (`shouldRetry` 429 branch, `CLAUDE_CODE_RETRY_WATCHDOG`, `anthropic-ratelimit-unified-reset` wait), result builder (`subtype:"success"`, `api_error_status`).
- Live probe, 2026-09-26: `query()` in streaming mode, model haiku, no API key → `apiKeySource: none`, two `rate_limit_event`s, `result success`, `usage_EXPERIMENTAL` output (quoted above).
- https://code.claude.com/docs/en/agent-sdk/overview (claude.ai login note)
- https://code.claude.com/docs/en/legal-and-compliance (authentication and credential use; "ordinary, individual usage of Claude Code and the Agent SDK")
- https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan (SDK credit plan, paused; SDK usage still draws from plan limits)
- https://code.claude.com/docs/en/agent-sdk/sessions (resume by ID, transcript location, cross-directory lookup)
