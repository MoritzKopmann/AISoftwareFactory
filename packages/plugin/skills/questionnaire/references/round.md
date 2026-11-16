# The `round-<N>.json` contract

The caller writes `.aisf/artifacts/<page-id>/round-<N>.json` before the build. One of two shapes.

## Shape A: a round of questions

```json
{ "cards": ["<name>"], "rows": ["<precedent row html>"] }
```

- A name is a card file `questions/<name>.html` in the page folder, from a `question-builder` `result: card`.
- A row is the `row:` html of a `result: settled`.
- Either list may be absent.

## Shape B: the Confirm round

```json
{
  "confirm": {
    "tasks": [{ "number": 1, "heading": "<string>", "blockedBy": [0], "hitl": false }],
    "summary": "<file relative to the page folder>"
  }
}
```

- `summary` is optional. Its HTML sits above the confirm.

## One shape per file

A file with both shapes fails the build.
