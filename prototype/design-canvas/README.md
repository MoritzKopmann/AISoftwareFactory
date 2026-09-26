# PROTOTYPE: local aisf design canvas (throwaway)

Answers [Prototype a local aisf design canvas instead of claude.ai](https://github.com/MoritzKopmann/AISoftwareFactory/issues/26):
can aisf design locally, in-house, well enough to replace claude.ai's Design type?

    node prototype/design-canvas/serve.mjs      # → http://127.0.0.1:4390/

- `skill/aisf-design/SKILL.md` is a rough `aisf:design`, written in our own words: the format, the craft rules and the rounds.
- `designs/postkarte-trip-library/` is a real design made by following that skill, for the brief behind
  postkarte#1057 (the trip library). It has `index.json`, `tokens.css` and `boards/*.html`.
- `board.html` is the design-session panel of a ticket page: every board in light and dark,
  pinned comments, a free message, **Send feedback** (one round message) and **Accept design**.
- `serve.mjs` stands in for the app. It serves the page and the folder, and pushes a reload over
  SSE when the session edits a file. It appends each sent message to `outbox.jsonl`, which is what
  the bridge would push into the session.

Reference for the comparison: the claude.ai canvas the real #1057 tickets were cut from,
https://claude.ai/artifact/9emkztnEeM57EdStanRj13 (`project/Main.dc.html`, `StatusLine.dc.html`, `States.dc.html`).
