---
name: project-design
description: >
  AISoftwareFactory design reference: where the tokens, fonts and rules of the app's look live,
  and where to find detail in docs/design. Use when designing or reviewing a screen of this app.
user-invocable: false
---

## Tokens

Source: `packages/app/assets/kit/kit.css`. On any conflict, `kit.css` wins over `docs/design`.

Print the light and dark token blocks:

```bash
awk '/^:root \{/,/^}/; /^:root\[data-theme=.dark.\] \{/,/^}/' packages/app/assets/kit/kit.css
```

Token roles: `docs/design/ui-direction.html` §1.

## Fonts

Files: `packages/app/assets/kit/fonts/`.

- **Atkinson Hyperlegible Next** 400/600/700: UI text.
- **JetBrains Mono** 400/500/700: headings, labels, chips, ids, code.

A design copies the woff2 files it needs into its folder and writes `@font-face` with relative URLs in `tokens.css`. `kit.css` uses root URLs (`/aisf/fonts/…`) that don't resolve there.

## Icons

No icon set yet (ui-direction §10). Status shapes ○ ● ■ ▲ ✓ (§4), other marks as text glyphs. Name any new one in the board note.

## Rules

- Orange (`--accent`) is never text. (§1)
- A status is colour + shape + text, never colour alone. (§4)
- Uppercase mono only for short chrome. (§1)
- 11 px is the floor. (§1)
- One density. (§1)

## Where to look

In `docs/design/ui-direction.html`:

- §1 foundations
- §3 shell
- §4 status vocabulary
- §5 cards and board rows
- §6 list rows
- §7 links and collapsing
- §8 state patterns
- §9 copy voice
- §10 still open

Also:

- `docs/design/board.html`: board and ticket page states.
- `packages/ui/src/app.css`: app component CSS.
