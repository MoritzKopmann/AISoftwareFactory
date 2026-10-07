# Figures

Read this only when you draw. A figure shows how something works. Prose only captions it.

## Honesty rules

- A figure earns its place by showing the real mechanism. No decoration.
- Every box is a symbol the plan names. Never invent a box.
- Counts measure the drawing and say so ("3 boxes drawn", not "3 modules").
- When a readout depends on geometry, generate the geometry in the page script. Never
  hand-place shapes and hand-type the number.
- A figure opens at rest in a real state. Never open on an empty or broken state.

## SVG mechanics

- Inline `<svg>` with a `viewBox`. It scales to the page. No fixed width or height.
- Text is at least 12 user units at the drawn scale. Smaller text is unreadable on narrow
  screens.
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
