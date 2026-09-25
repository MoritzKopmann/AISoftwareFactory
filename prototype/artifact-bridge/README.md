# Prototype: artifact-to-session bridge

Throwaway prototype for **Prototype the artifact-to-session bridge** (issue #8 on the map
*generic workflow skills + AISoftwareFactory v1 spec*). This is not production code. Its only job is
to make the bridge concrete enough to decide on.

## Run it

```sh
npm install
node server.mjs            # uses ./demo-project; open http://127.0.0.1:4317/
```

The console at `/` lists artifacts waiting for you and streams the session live. The demo skill
`demo-project/.claude/skills/demo-questionnaire` stands in for plan-ticket's questionnaire.
Env vars: `PORT`, `MODEL` (default `haiku`), `AISF_HOME` (default `~/.aisf`), `FIRST_PROMPT`.

## Shape

```
 skill (in session)                 app (server.mjs)                         browser page
 ──────────────────                 ────────────────                         ────────────
 Write page.html ─┐
 aisf_show_artifact(id,title,path) ─▶ copy → ~/.aisf/artifacts/<session>/<id>/
                                     bump version, SSE "reload" ───────────▶ tab reloads to vN
                                     serve /a/<id>/?t=<token>, inject ─────▶ window.aisf
                                                                             aisf.state.save(obj)
                                     PUT /a/<id>/_state → state.json ◀────── (answers survive reload)
                                                                             aisf.send(type,data)
 user message ◀── push onto prompt ◀─ POST /a/<id>/_events ◀─────────────── 202 {uuid, queued}
 "[aisf artifact event] artifact=<id> v<n> type=<t>" + JSON block
 CLI replays it / result.user_message_uuids ─▶ SSE "ack" {uuid, consumed} ─▶ "✓ seen by session"
```

- **Session:** one long-lived `query()` whose prompt is an async iterable that never ends, so the
  session sits idle between turns and a click just pushes the next message onto it.
- **Skill → app:** an in-process SDK MCP tool, `aisf_show_artifact({id, title, file_path, assets?})`,
  declared with `alwaysLoad: true`. Otherwise it is deferred and costs a ToolSearch call.
  Calling it again with the same id updates the page in place.
- **Page → app:** `bridge.js`, which the app injects into `<head>`. The whole page-side API:
  `aisf.send`, `aisf.state.load/save`, `aisf.on('ack'|'reload'|'status')`. Transport is plain
  HTTP POST up and SSE down, with no WebSocket.
- **App → session:** a `SDKUserMessage` with its own `uuid`, text-tagged so the skill can pattern-match it.
- **Guard:** binds to `127.0.0.1` only. Each artifact gets a random token in its URL and the
  `x-aisf-token` header, and a foreign `Origin` is refused, because any website in the same
  browser can POST to localhost.

## What the run showed (Claude Code 2.1.282, SDK 0.3.282, haiku, headless Chrome)

| Step | Result |
|---|---|
| `/demo-questionnaire` as the first message | Loaded from the project's `.claude/skills`. The agent wrote the page and published v1 in ~50 s (cold start included). |
| Ping click | Became a user message and got the reply "Pong." The page got its `consumed` ack 1.2 s after the click. |
| Two answer clicks, 0 ms apart, during the Ping turn | **Merged into one turn** (`user_message_uuids` = 2). Both acks arrived together 2.9 s after the clicks. |
| Page reload | `aisf.state.load()` restored both answers from the app's store. |
| Submit | The agent wrote round 2 and republished the same id. The open tab reloaded itself to v2 26 s after the click. |
| POST with no token, or with a foreign Origin | `403`. |

## Findings that shape the decision

1. **Per-click sends are noisy.** Each one costs a turn, and clicks close together merge
   unpredictably. The questionnaire should `send` only on round-level actions (Submit,
   Confirm, Reopen). Card choices go to `aisf.state.save` alone.
2. **`state.save` replaces `artifact.publish(html)`.** The answers live as app-side JSON the
   agent can also read, not baked into the HTML. A republish with a new HTML file doesn't clobber them.
3. **The event message replaces the "republish notice + watch".** There is nothing to poll and no
   `read`, and the "Copy answers" paste fallback is no longer needed.
4. **Acks are free.** The CLI's replay of the injected message (or `result.user_message_uuids`)
   tells the page "seen by session", which is the honest status to show.
5. **Open:** what happens to clicks when the session isn't running (crashed, or finished). The prototype
   queues them in memory. This belongs to *Failure and recovery*.
