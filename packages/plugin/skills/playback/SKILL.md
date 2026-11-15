---
name: playback
description: >
  The playback map's JSON contract and example. Use when writing `playback.json`.
user-invocable: false
---

# playback

## Contract

The playback map, drawn for you from data. Holds one `<script type="application/json">` child.
Write data only: no layout, no coordinates. The element draws one box per class, one block per
public function, and wires from a function's right edge to the next function's left edge. A
switch per criterion (and "All") shows that criterion's wires and a route sheet of its steps.
Sends nothing.

```html
<aisf-playback>
  <script type="application/json">
    {
      "modules": [{ "id", "name"?, "kind"?: "frontend", "bus"?: true, "mark", "tag", "does"?, "note"? }],
      "screens": [{ "id", "module", "file", "role", "mark" }],
      "classes": [{ "id", "module", "layer": "presentation"|"business"|"infrastructure"|null, "screen"?,
                    "file", "name", "kind", "mark",
                    "fns": [{ "id", "sig", "mark", "does", "source"?, "pending"? }] }],
      "criteria": { "AC1": { "title",
                    "paths": [{ "actor", "label"?, "steps": [[from|null, "cls.fn", "call", "via"?]], "end": ["cls.fn", "text"] }] } }
    }
  </script>
</aisf-playback>
```

- `mark` is `new`, `changed`, `untouched` or `removed`. `via` is `entry`, `event`, `facade` or `http`.
- `modules` run left to right as listed, the `kind: "frontend"` one first. Its classes carry
  `layer: null`. `bus: true` is the event bus: its fn is the event.
- A module whose classes are all `untouched` starts folded as one box showing its `does`. A click
  unfolds it.
- A path starts at one `from: null` step, named by `actor`. A criterion with two or more paths
  labels them A, B, …
- A fn that is not `new` needs a `source`, or it gets a warning outline. So does a step that names
  a `cls.fn` not in `classes`.
- `pending: "Q3"` makes the block read "pending Q3".
- Bad JSON draws one warning box and nothing else.
- **Write every `<` in a JSON string as `<`.** A raw `</script` ends the script tag early.

## Map guidance

- **One block per affected public fn**, in `classes[].fns`.
- List every interface a path calls: controller, facade, use case, handler, adapter, repository.
- The event bus is a module whose fn is the event.
- No private methods or helpers. An adapter does not name its port. No separate list of facades
  or adapters.
- `does` says what the fn must do for this ticket. Aim for 100 characters or less.
- Untouched code on a path is listed with a short role text.
- A branch inside a fn is not a second path: it goes in that fn's `does`.
- `criteria` has one entry per acceptance criterion, with its `paths`.

## Example

Read `example.json` beside this file when drafting a first `playback.json`.
