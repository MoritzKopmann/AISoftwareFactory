#!/usr/bin/env bash
# Throwaway spike for issue #2: does a user message written to a running
# `claude -p --input-format stream-json` process get picked up mid-turn
# (between tool calls) or only after the current turn finishes?
#
# Usage: research/spikes/inject-mid-turn.sh [outdir]
# Writes out.jsonl (stream-json output) and prints a condensed view.
set -euo pipefail
OUT="${1:-/tmp/claude-inject-spike}"
mkdir -p "$OUT"
cd "$OUT"

feed() {
  # Message 1 starts a turn that blocks in a ~12 s Bash call.
  echo '{"type":"user","uuid":"11111111-1111-4111-8111-111111111111","message":{"role":"user","content":"Run the bash command `sleep 12 && echo done` once, then report its output in one short sentence."},"parent_tool_use_id":null}'
  sleep 5
  # Message 2 arrives while the Bash call is still running.
  echo '{"type":"user","uuid":"22222222-2222-4222-8222-222222222222","message":{"role":"user","content":"Injected note: also tell me the secret word PINEAPPLE in your final reply."},"parent_tool_use_id":null}'
  sleep 45
}

feed | timeout 90 claude -p --model haiku \
  --input-format stream-json --output-format stream-json --verbose \
  --replay-user-messages \
  --allowedTools 'Bash(sleep *)' --permission-mode dontAsk \
  > out.jsonl 2> err.txt || true

jq -c '{t:.type, s:.subtype, uuid:.uuid, replay:.isReplay,
        umu:.user_message_uuid, umus:.user_message_uuids,
        turns:.num_turns, result:.result,
        c:(.message.content // null | tostring | .[0:160])}' out.jsonl \
  | grep -v '"s":"init"'
