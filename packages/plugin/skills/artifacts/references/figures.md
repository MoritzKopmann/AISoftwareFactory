# Figures

A figure shows how something works. Prose only captions it. Each question
designs its own visual, as plain HTML or SVG inside `<aisf-figure caption="…">`. The kit gives no
ready-made diagram. Every kept class and tag is on `/aisf/specimens.html`.

Mark each box or arrow `new`, `changed` or `untouched`. Leave a mark out for a plain one.
Pages target desktop width only.

## Free visual rules

- Colour only through kit tokens. Content inside `<aisf-context kind="mockup">` is exempt.
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

## SVG mechanics

- Inline `<svg>` with a `viewBox`. It scales to the page. No fixed width or height.
- Text is at least 12 user units at the drawn scale.
- Colour only through kit tokens, so the figure reads in light and dark: `fill="var(--surface)"`,
  `stroke="var(--border-strong)"`, `var(--accent)`, `var(--text)`.
- Give each figure `role="img"` and a `<title>` that says what it shows.
- A switch is a `<button class="aisf-switch" aria-pressed="false">`. The page script flips
  `aria-pressed` and redraws.
- Wrap the figure in `<aisf-figure caption="…">`.

## Page scripts

The page CSP is `script-src 'self' 'nonce-…'`.

- Write plain `<script>` tags. The app stamps the nonce on each one. Add none yourself.
- No inline `on*=` handler attributes. The CSP blocks them. Use `addEventListener`.
- No `eval`, no `new Function`. The CSP blocks them.
- A script file in the artifact directory also loads: `<script src="figure.js"></script>`.
- Scripts draw figures only. They never call `aisf.send` or `aisf.userInputState`. They may call
  `aisf.on('status', …)`.

## Styling figures

Add one `<style>` to the page. Use only kit tokens (`var(--accent)`, `var(--surface)`,
`var(--figure-bg)`, `var(--figure-grid)`, `var(--lane-alt)`, …). No hex colours, no fonts,
no URLs.

Use the kit figure classes:

- `aisf-lane`: a row of nodes in flow order.
- `aisf-node`: one box. Add `aisf-node-new`, `aisf-node-changed` or `aisf-node-untouched`.
- `aisf-arrow`: a link between nodes.
- `aisf-stop`: where a flow ends.
- `aisf-switch`: a button with `aria-pressed`, driven by the page script.
- `aisf-readout`: a computed value shown beside a figure.

```html
<div class="aisf-lane">
  <span class="aisf-node aisf-node-new">Parser</span>
  <span class="aisf-arrow">→</span>
  <span class="aisf-node aisf-node-changed">Router</span>
  <span class="aisf-arrow">→</span>
  <span class="aisf-node aisf-node-untouched">Store</span>
  <span class="aisf-stop">end</span>
</div>
<button class="aisf-switch" aria-pressed="false">Show retries</button>
<output class="aisf-readout">3 boxes drawn</output>
```

The class names are those on `/aisf/specimens.html`. Look there to see each in every state.
