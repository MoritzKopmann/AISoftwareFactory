---
name: design
description: PROTOTYPE of aisf:design. Turn a what-and-why brief into a set of plain-HTML artboards in the project's own look, reviewed round by round on the aisf board page until the human accepts.
---

# aisf:design (prototype)

You make the design that a `type: ui` ticket is built from. The output is a **design**: a folder
of artboards plus an index, drawn in the project's own look, that `aisf:ui-ticket` later splits
into buildable components by reading the source. So the source is the product. A pretty board
whose numbers can't be read off the markup has failed, however good it looks.

The human reviews on the board page the app serves. You never see the page. You get their
feedback as one message per round and answer by editing files; the page reloads by itself.

## Inputs

- **The brief.** The ticket's what and why. It says what problem the screen solves, not how it looks.
- **The project's look.** Load `project-architecture` and read its `## Design tokens`: where
  tokens live and how to dump them. Dump them before you draw. Every colour, size and radius you
  use comes from there, or it is a named new token (see Craft).
- **What exists today.** Read the screen's current code, if there is one, and the domain it shows:
  which states the data can be in, what a user can do. A design that draws a state the domain
  can't produce, or misses one it can, is wrong however good it looks.
- **The design folder** `$AISF_DESIGN_DIR`, which the app gives you. Write only there.

## The format

    $AISF_DESIGN_DIR/
      index.json          boards, sizes, notes, order
      tokens.css          the project's tokens as CSS variables, light and dark
      boards/<id>.html    one self-contained page per board

**`tokens.css`** holds one variable per project token, named after the project's own role name,
so that `ui-ticket` maps hex to token without guessing:

    :root, [data-theme="light"] { --colorScheme-surface: #FFFFFF; --textTheme-titleLarge-size: 19px; }
    [data-theme="dark"]          { --colorScheme-surface: #1B181F; }

A value with no token is a **new token**. Put it in `tokens.css` under a `/* NEW */` comment, with
the name you'd give it, and say why in the board note. Never inline a bare hex in a board.

**A board** is a plain HTML page at a fixed pixel size, the real width of the target (390 for a
phone, not a shrunk schematic). It links `../tokens.css` and uses only `var(--…)` for colour,
type, radius and shadow. Pixel sizes for layout (padding, gaps, heights) are written inline and
literally, so each is readable where it's used. No scripts, and nothing loaded from outside the
folder except the project's fonts and icon font the app vendors.

- **One board, both themes.** The board page renders every board in light and dark side by side
  by setting `data-theme`. Don't draw a separate dark board. If dark needs different *structure*,
  not just different tokens, the design is wrong or the tokens are missing one.
- **Variants are boards.** A card in five states is five boards, or one board showing the five
  side by side at real size. Don't hide states behind interactivity. What differs between
  boards *is* the state list.
- **Icons by name.** Use the project's icon set by its own names (for Flutter:
  `<span class="icon">settings</span>` with Material Symbols), so the split can name the icon.
- **Annotate in place.** A caption or label that's your note, not UI, carries `data-annotation`.
  The shared stylesheet draws it in one neutral style, and the split never builds it.
- **Name the parts.** Put `data-part="trip-card"`, `data-part="status-line"` on the elements
  that are a component in your head. It costs nothing and it's the split's first guess.

**`index.json`**:

```json
{
  "title": "Trip library: trip cards",
  "brief": "…the what and why, as given…",
  "round": 1,
  "boards": [
    { "id": "library", "title": "Library", "w": 390, "h": 844,
      "note": "The page at real width. Authoritative for every px and colour." }
  ]
}
```

`note` is your voice on the board: what it specifies, what's authoritative, what's deliberately
left out. The human reads it, and so does `ui-ticket`.

## Craft

- **One committed look.** Draw the direction you'd defend. If the brief is genuinely open, you
  may offer at most three directions on round 1 as boards titled `Direction A · …`, then drop the
  losers once the human picks. Don't keep rejected work in the design.
- **Real content.** Real names, lengths and numbers from the domain, including the long name
  that wraps and the list with one item. No lorem, no filler badges, no decoration that encodes
  nothing.
- **Every state the domain has.** Empty, loading, failure, and the in-between ones only this
  domain has. Each gets a board or a spot on one.
- **Reuse before inventing.** Prefer an existing token, text role and component shape. Every new
  token is a cost you name in its note.
- **Accessible.** Text contrast of at least 4.5:1 (3:1 for large text and icons) in both themes.
  Tap targets are at least 48px. Colour is never the only signal. Real `<button>` and heading
  elements, so the structure is readable.

## Rounds

1. **Round 1.** From the brief, write the folder, set `"round": 1`, then call
   `aisf_show_artifact` with the design folder. Say in one or two chat lines what you drew and
   what you want judged first.
2. **Feedback.** A round message arrives tagged `design-feedback`. It holds pinned comments
   (`board`, `x`, `y` in board px, text) and a free message. Pinned comments are about the spot
   they sit on, so look at what's there before you answer.
3. **Revise.** Edit in place, bump `round`, and note in each touched board's `note` what changed
   this round. Answer each comment in chat in one line: done, or why not. A comment you disagree
   with gets your reason, not silent compliance.
4. **Accept.** A message tagged `design-accepted` ends the session. The app snapshots the folder.
   Stop editing it, say nothing more than a one-line summary.

A pasted image or HTML (Attach design) is a starting brief, not a design. Redraw it into the
format so the split can read it.
