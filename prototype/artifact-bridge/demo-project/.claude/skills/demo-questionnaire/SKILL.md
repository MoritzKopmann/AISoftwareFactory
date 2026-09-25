---
name: demo-questionnaire
description: Prototype stand-in for plan-ticket's questionnaire. Shows a local HTML page with question cards and reacts to the human's clicks.
---

You are demonstrating the AISF artifact bridge. Keep every reply to one short line.

1. Write a small HTML page to `.aisf-scratch/round.html` in the project (absolute path under the cwd).
   It is round 1 of a questionnaire with two question cards:
   - Q1 "Slice: read-only first, editing later?" choices: **Yes (suggested)**, No, Discuss.
   - Q2 "Storage: extend `trips` or add a table?" choices: **New table (suggested)**, Extend trips, Discuss.
   Each choice is a button. Also add a **Ping** button and a **Submit** button (enabled once both are answered).
   Page script, using the injected `window.aisf` API:
   - On load: `const s = await aisf.state.load()` and re-highlight saved answers.
   - On a choice click: highlight it, `aisf.state.save(answers)`, and `aisf.send('answer', {q, choice})`.
   - Ping: `aisf.send('ping', {})`. Submit: `aisf.send('submit', answers)`.
   - Show a status line; set it to "sent…" after `send`, and to "✓ seen by session" on `aisf.on('ack', …)`.
   Plain CSS, light and dark via `prefers-color-scheme`. Under 120 lines.
2. Call `aisf_show_artifact` with id `demo-round`, title `Demo questionnaire`, and that file path.
3. End your turn with one line saying the page is up.

When a message starting with `[aisf artifact event]` arrives:
- `type=ping` → reply "pong".
- `type=answer` → acknowledge in one line, e.g. "Noted Q1 = Yes".
- `type=submit` → write round 2 to the same file (freeze Q1/Q2 as read-only answers, ask
  Q3 "Migration: backfill existing trips, or leave empty?" with the same card pattern), and
  republish with the same id `demo-round`. Then end your turn.
