---
name: artifacts
description: >
  Build a bridge page from the <aisf-*> kit elements, show it with aisf_show_artifact and read
  the human's answer. Use when the human must pick between options, answer several questions at
  once, or see a figure. Triggers: "show a page", "artifact", "bridge page", "ask on a page".
---

# artifacts

Write one HTML page. The app serves it. The human answers on it. The answer comes back as the
result of `aisf_show_artifact`.

Read `references/elements.md` before writing any page. Read `references/figures.md` only when
you draw a figure.

## When to show a page

- Show a page when the human picks between options, answers several questions at once, or
  needs a figure.
- For "do X and report", use a plain `aisf_checkpoint`.

## File location

- Write the page to `.aisf/artifacts/<artifactId>/index.html` in the worktree.
- Assets may sit beside it in the same directory.
- `.aisf/` is gitignored. Pages are never committed.

## What the app adds

The app injects `kit.css`, `bridge.js` and `kit.js` into every page. The page never includes
them.

## Showing

Call `aisf_show_artifact` with `{artifactId, title}`.

- `artifactId` matches `^[a-z0-9][a-z0-9-]{0,63}$`.
- A missing `index.html` returns an error text. The call does not wait.

## Next round

- Edit the same `index.html`. Add the new round. Call `aisf_show_artifact` again with the same
  `artifactId`. That republishes on the same page.
- Earlier rounds stay in the file. The kit freezes them.
- A page is open only for its own wait. After a Submit, a later plain `aisf_checkpoint` does
  not reopen it. To ask again on the page, republish it.

## Reading the answer

The call returns the human's event:

    <aisf-event artifact=<id> kind=<kind> round=<n>>{json}</aisf-event>

- `kind` is `submit`, `confirm` or `reopen`.
- The payload shape is the kit's. See `references/elements.md`.
- The human can also answer a page's wait from the ticket page's prompt. The result is then
  plain text, not an `<aisf-event>`. Read it as the human's answer.
- If the call returns a text telling you to end your turn (the run was stopped), end the turn.

## Fallback

If the session ended while waiting (window passed, app restart, crash), the same tagged event
arrives later in the resume prompt. Read it the same way.

## Rules

- **No outside origins**, for any resource type: no CDN, remote font, remote image or remote
  fetch. Images come from the artifact directory or `data:` URIs.
- **The kit owns** rounds, state, Accept all, Submit/Confirm/Reopen and freezing. Page scripts
  are for figures only. They never call `aisf.send` or `aisf.userInputState`. They may listen with
  `aisf.on('status', …)`.
- **No `localStorage`.**
- **No header, no ticket identity.** The page starts at the current round.
- **Styling:** kit elements are styled by the kit alone. A page may add one `<style>` for its
  figures, using only kit tokens and the kit figure classes: no hex colours, no fonts, no URLs.
  Content inside `<aisf-context kind="mockup">` is exempt. It may use its own colours, system
  font stacks and inline `style=""`.
- **Graphics carry the page.** Prose only captions them.
- **One short card per question.**
- **Narrow width works,** with no horizontal scroll.

## Index

Every element is in `references/elements.md`.

- `<aisf-round>`: one round of questions or one confirm. Sends the event.
- `<aisf-question>`: one question. Holds cards, plus Other and Discuss.
- `<aisf-card>`: one choice. May be `suggested`.
- `<aisf-context>`: code, mockup or diagram shown with a question.
- `<aisf-confirm>`: note, Confirm and Reopen for a round.
- `<aisf-task>`: one planned task with a hitl switch. Lives in a confirm.
- `<aisf-meta>`: a labelled value.
- `<aisf-figure>`: a captioned figure.
- `<aisf-tree-node>`: one row of the decision tree.
