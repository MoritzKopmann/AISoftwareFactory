# Figures

A figure shows how something works. Prose only captions it. Copy the example for the piece you
need and swap in the plan's names. Every class and tag is on `/aisf/specimens.html`.

Mark each box or arrow `new`, `changed` or `untouched`. Leave a mark out for a plain one.

## Compare

One panel per option. `aisf-panel-now` is today, `aisf-panel-suggested` is the suggestion.

```html
<div class="aisf-compare">
  <div class="aisf-panel aisf-panel-now">
    <h3>Now</h3>
    <p>Runs start in the scheduler.</p>
  </div>
  <div class="aisf-panel aisf-panel-suggested">
    <h3>Option A</h3>
    <p>A queue starts the runs.</p>
  </div>
</div>
```

## Sequence

`<aisf-actor>` is a column, `<aisf-step>` an arrow row. The kit draws it.

```html
<aisf-sequence>
  <aisf-actor name="scheduler"></aisf-actor>
  <aisf-actor name="queue"></aisf-actor>
  <aisf-actor name="runner"></aisf-actor>
  <aisf-step from="scheduler" to="queue" mark="new">enqueue(run)</aisf-step>
  <aisf-step from="queue" to="runner" mark="changed">start(run)</aisf-step>
  <aisf-step from="runner" to="scheduler" mark="untouched">done</aisf-step>
</aisf-sequence>
```

## Diff

Two `<aisf-context kind="code">`, before then after, by path.

```html
<div class="aisf-diff">
  <aisf-context kind="code" path="src/retry.ts" line="4">const tries = 1;</aisf-context>
  <aisf-context kind="code" path="src/retry.ts" line="4">const tries = 3;</aisf-context>
</div>
```

## State

`<aisf-step>` inside `<aisf-state>`. States are the distinct `from` and `to` values.

```html
<aisf-state>
  <aisf-step from="ready" to="in-progress" mark="untouched">claim</aisf-step>
  <aisf-step from="in-progress" to="in-review" mark="new">open PR</aisf-step>
  <aisf-step from="in-review" to="in-progress" mark="changed">rework</aisf-step>
</aisf-state>
```

## Modmap

`layers` lists the rows. Each `<aisf-unit>` sits in a module column and a layer row.

```html
<aisf-modmap layers="presentation business infrastructure">
  <aisf-unit module="runs" layer="presentation" mark="untouched">RunRoutes</aisf-unit>
  <aisf-unit module="runs" layer="business" mark="changed">RunService</aisf-unit>
  <aisf-unit module="queue" layer="business" mark="new">QueueService</aisf-unit>
  <aisf-unit module="queue" layer="infrastructure" mark="new">QueueRepository</aisf-unit>
</aisf-modmap>
```

## Table

`table.aisf-table`. A cell takes `aisf-node-new`, `aisf-node-changed` or `aisf-node-untouched`.

```html
<table class="aisf-table">
  <thead>
    <tr>
      <th>Library</th>
      <th>Size</th>
      <th>Upkeep</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>Alpha</td>
      <td class="aisf-node-new">4 kB</td>
      <td>weekly</td>
    </tr>
    <tr>
      <td>Beta</td>
      <td class="aisf-node-changed">40 kB</td>
      <td>yearly</td>
    </tr>
  </tbody>
</table>
```

## Scope

```html
<div class="aisf-scope">
  <ul class="aisf-scope-in">
    <li>Retry failed uploads</li>
  </ul>
  <ul class="aisf-scope-out">
    <li>Retry failed downloads</li>
  </ul>
</div>
```

## Free SVG

The escape hatch, for a figure no piece fits. Use `aisf-shape` (with `-new`, `-changed`,
`-untouched`), `aisf-label` and `aisf-edge`. Wrap it in `<aisf-figure>`. Mockups stay the
escape hatch for UI: `<aisf-context kind="mockup">`.

```html
<aisf-figure caption="Parser feeds the router">
  <svg viewBox="0 0 280 80" role="img">
    <title>Parser feeds the router</title>
    <rect class="aisf-shape aisf-shape-new" x="4" y="20" width="110" height="40" />
    <text class="aisf-label" x="59" y="45" text-anchor="middle">Parser</text>
    <path class="aisf-edge" d="M114 40 H166" />
    <rect class="aisf-shape aisf-shape-changed" x="166" y="20" width="110" height="40" />
    <text class="aisf-label" x="221" y="45" text-anchor="middle">Router</text>
  </svg>
</aisf-figure>
```

## Chips

Hand-built text chips still work for a flow no piece draws. Prefer a piece.

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
