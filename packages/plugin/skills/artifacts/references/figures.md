# Figures

A figure shows how something works. Prose only captions it. Each question
designs its own visual, as plain HTML or SVG inside `<aisf-figure caption="…">`. Any HTML, SVG and
CSS is allowed. Only the rules below bind.

## Free visual rules

- Colour only through kit tokens (`var(--surface)`, `var(--accent)`, `color-mix()` of tokens,
  opacity). No hex colours, no URLs. Content inside `<aisf-context kind="mockup">` is exempt.
- Every figure reads in light and dark. Token colours give this.
- Every selector in a figure's `<style>` starts with an id or class prefixed `<name>-`. A
  figure's CSS never restyles `aisf-*` elements.
- A visual's script touches only its own question: it never reads or writes another question's
  elements.
- Every id is prefixed with the question's `name` (`q1-retry-box`), so ids never clash on the
  page.

## Playback

One JSON object; the kit draws the map. See `<aisf-playback>` in `references/elements.md` for the full shape.

```html
<aisf-playback>
  <script type="application/json">
    {
      "modules": [{ "id": "runs", "mark": "changed", "tag": "changed" }],
      "screens": [],
      "classes": [
        {
          "id": "useCase",
          "module": "runs",
          "layer": "business",
          "file": "retry-run.ts",
          "name": "RetryRun",
          "kind": "use case",
          "mark": "changed",
          "fns": [
            {
              "id": "execute",
              "sig": "execute(runId)",
              "mark": "new",
              "does": "Queues the run again."
            },
            {
              "id": "load",
              "sig": "load(runId)",
              "mark": "changed",
              "source": "src/run.ts",
              "does": "Reads one run."
            }
          ]
        }
      ],
      "criteria": {
        "AC1": {
          "title": "a failed run can be retried",
          "paths": [
            {
              "actor": "owner",
              "steps": [
                [null, "useCase.execute", "POST /runs/:id/retry", "entry"],
                ["useCase.execute", "useCase.load", "load(runId)"]
              ],
              "end": ["useCase.execute", "run queued"]
            }
          ]
        }
      }
    }
  </script>
</aisf-playback>
```

## Honesty rules

- A figure earns its place by showing the real mechanism. No decoration.
- Every box is a symbol the plan names. Never invent a box.
- Counts measure the drawing and say so ("3 boxes drawn", not "3 modules").
- When a readout depends on geometry, generate the geometry in the page script. Never
  hand-place shapes and hand-type the number.
- A figure opens at rest in a real state. Never open on an empty or broken state.

## Accessibility

- Give each SVG `role="img"` and a `<title>` that says what it shows.
- A switch is a `<button aria-pressed="false">`. The page script flips `aria-pressed` and redraws.

## Page scripts

The page CSP is `script-src 'self' 'nonce-…'`.

- Write plain `<script>` tags. The app stamps the nonce on each one. Add none yourself.
- No inline `on*=` handler attributes. The CSP blocks them. Use `addEventListener`.
- No `eval`, no `new Function`. The CSP blocks them.
- A script file in the artifact directory also loads: `<script src="figure.js"></script>`.
- Scripts draw figures only. They never call `aisf.send` or `aisf.userInputState`. They may call
  `aisf.on('status', …)`.
