---
name: design
description: >
  Draw the screen of a type: ui idea as plain-HTML boards in the project's own look, revise it
  from pinned comments on the board page, and on Accept hand the ticket to planning.
  Use when a type: ui idea needs its design. Triggers: "design #N", "draw #N".
---

# design

Make the design a `type: ui` idea is built from. The output is a folder of boards drawn in the
project's own look. A later split reads the markup, so the source is the product: a pretty
board whose numbers can't be read off its HTML has failed.

The human reviews on the board page the app serves. You never see the page. Feedback comes back
as events. You answer by editing files. The page reloads by itself.

`gh` infers the repository from the current checkout. Never pass `-R`. Every issue write goes
through `aisf:github-issue`.

## Input and precondition

Argument: the issue number. If none, ask.

```bash
gh issue view <n> --json title,body,labels,state
```

Go on only for an open issue with **no** `status:` label and the `type: ui` label. Anything else
→ stop and say why. A stop here writes nothing.

The issue body is the brief: what the screen solves, not how it looks.

## Stop points

Mode is **AFK** when the `aisf_escalate` tool is present, **hand-run** otherwise. Decide once.
Escalate `spec` = `aisf_escalate({kind: 'spec', reason})`. Hand-run: ask the human instead.

## 1. The project's look

Load `project-design`. `Unknown skill` → escalate `spec`, "project has no project-design slot".
Write nothing before this.

It names the project's tokens (by role), fonts, icon set and components. Read the screen's
current code, if any, and the domain it shows: which states the data can be in, what a user can
do. A state the domain can't produce is wrong. A missing one is wrong.

## 2. The folder

Write only to `.aisf/artifacts/design/` in the worktree. The id `design` is reserved for this.

    .aisf/artifacts/design/
      index.json          boards, sizes, notes, order
      tokens.css          the project's tokens as CSS variables, light and dark
      boards/<id>.html    one self-contained page per board

**`tokens.css`**: one variable per token, named after the project's own role name.

    :root, [data-theme="light"] { --colorScheme-surface: #FFFFFF; }
    [data-theme="dark"]          { --colorScheme-surface: #1B181F; }

A value with no token is a **new token**. Put it in `tokens.css` under a `/* NEW */` comment,
and say why in the board's `note`. Never inline a bare hex in a board.

**A board** is a plain HTML page at a fixed pixel size, at the real width of the target (not a
shrunk schematic). It links `../tokens.css`.

- Colour, type, radius and shadow: only `var(--…)`.
- Layout px (padding, gap, height) are written inline and literally.
- No scripts. No remote URL of any kind: fonts and icons come from local files in the folder or
  system stacks.
- **One board, both themes.** The page renders it light and dark by setting `data-theme`. Never
  draw a separate dark board. Different structure in dark means a missing token.
- **Variants are boards.** A card in five states is five boards, or one board with the five side
  by side at real size. Never hide a state behind interaction.
- **Icons by the project's icon names**, so the split can name the icon.
- **`data-annotation`** on every caption or label that is your note, not UI. The split never
  builds it.
- **`data-part="…"`** on every element that is a component in your head.

**`index.json`**:

```json
{
  "title": "Trip library: trip cards",
  "brief": "the what and why, as given",
  "round": 1,
  "boards": [
    {
      "id": "library",
      "title": "Library",
      "w": 390,
      "h": 844,
      "note": "What this board specifies, what is authoritative, what is left out."
    }
  ]
}
```

`note` is your voice on the board. The human reads it, and so does the split.

## 3. Craft

- **One committed look.** Draw the direction you'd defend. If the brief is truly open, offer up
  to 3 boards titled `Direction A · …` on round 1. Delete the losers once the human picks.
- **Real content.** Real names, lengths, numbers. Include the long name that wraps, the empty
  list, the one-item list. No lorem, no decoration that encodes nothing.
- **Every domain state.** Empty, loading, failure, and the in-between ones only this domain has.
- **Reuse before inventing.** Existing token, text role, component shape first. Each new token
  is a cost you name.
- **Accessible.** Text contrast 4.5:1, icons 3:1, in both themes. Targets at least 48 px. Colour
  is never the only signal. Real `<button>` and heading elements.

## 4. The loop

1. Write the folder with `"round": 1`.
2. `aisf_show_artifact({ artifactId: 'design', title })`. Say in one or two chat lines what you
   drew and what to judge first.
3. The call returns the human's event, read as in `aisf:artifacts` (`<aisf-event … kind=…>`).
   If the session ended while waiting, the same event arrives in the resume prompt. Read it the
   same way.

### `design-feedback`

Payload: `round`, `comments` (each `n`, `board`, `theme`, `x`, `y`, `text`), `message`.
`x` and `y` are in board px.

1. For each comment, read the markup at that board px first. A pin is about the spot it sits on.
2. Edit the boards in place.
3. Bump `round`. In each touched board's `note`, say what changed this round.
4. Answer each comment in one chat line: done, or why not. If you disagree, give your reason.
   Never comply silently.
5. Republish with `aisf_show_artifact({ artifactId: 'design', title })`.

A plain-text answer from the ticket page counts as `message`, with no pins.

### `design-accepted`

Payload: `round`. Stop editing the folder. Then:

1. Write a `## Design` section into the issue body, through `aisf:github-issue` (edit in
   place): the board URL, the folder path `.aisf/artifacts/design/` in the `-authoring`
   worktree, the accepted round, and the what/why brief. Keep `type: ui`.
2. Guard `idea → plan` (`aisf:github-issue`, _Guarded transitions_).
3. End with one summary line.

Read the body back: length 0 → stop and report.
