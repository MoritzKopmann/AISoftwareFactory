# The `<aisf-*>` elements

Compose a page from these tags. The kit styles and wires them. Every example uses invented
content.

Each section lists the element's attributes on an `Attributes:` line. Events and payloads
follow.

A page is a list of rounds. A round holds questions, or one confirm.

## `<aisf-round>`

Attributes: `number`

One round. `number` is the round number, counting from 1. The round adds an action bar with
`Accept all remaining` and `Submit` when it holds questions. It owns saving, freezing and the
one event it sends.

Events sent, one per round:

- **Submit** (a round of questions): `kind=submit`, payload
  `{"answers":[{"question":"<name>","choice":"<value>|other|discuss","text":"…","note":"…"}]}`.
  `text` is set for `other`. `note` is set for `discuss`, when typed.
- **Confirm** or **Reopen** (a round holding `<aisf-confirm>`): `kind=confirm` or
  `kind=reopen`, payload `{"note":"…","hitl":{"<task number>":true}}`. `note` is left out when
  empty. A Reopen needs a note.

Submit stays disabled until every question is answered.

```html
<aisf-round number="1">
  <aisf-question name="storage" heading="Where do notes live?">
    <aisf-card value="file" suggested why="Smallest change">A file per note</aisf-card>
    <aisf-card value="db">One database table</aisf-card>
  </aisf-question>
</aisf-round>
```

## `<aisf-question>`

Attributes: `name`, `heading`, `assumes`

One question. `name` is the key in the answer. `heading` is the question text. `assumes` names
what the question rests on. Holds `<aisf-card>` and optional `<aisf-context>`. The kit adds an
Other choice with a text field and a Discuss choice with a note.

Sends no event itself. Its answer joins the round's Submit payload.

```html
<aisf-question name="retry" heading="Retry failed uploads?" assumes="uploads are idempotent">
  <aisf-card value="yes">Yes, three times</aisf-card>
  <aisf-card value="no">No</aisf-card>
</aisf-question>
```

## `<aisf-card>`

Attributes: `value`, `suggested`, `why`

One choice. `value` is the answer sent. `suggested` marks the choice Accept all picks. `why`
is one short line shown with the suggestion. The body is the label: keep it short.

```html
<aisf-card value="queue" suggested why="Keeps requests fast">Queue the work</aisf-card>
```

## `<aisf-context>`

Attributes: `kind`, `path`, `line`

Material shown with a question. `kind` is `code`, `mockup` or `diagram`. `path` and `line`
name the source of a `code` snippet. A `mockup` may use its own colours, system font stacks
and inline `style=""`. Sends nothing.

```html
<aisf-context kind="code" path="src/greeter.ts" line="12"
  >export const greet = () => 'hi';</aisf-context
>
```

## `<aisf-confirm>`

Attributes: none

The close of a plan round: a note, Confirm and Reopen. It can hold `<aisf-task>` elements. It
takes no attributes. The round sends Confirm or Reopen with the note and each task's hitl
switch.

```html
<aisf-round number="2">
  <aisf-confirm>
    <aisf-task number="1" heading="Add the greeter"></aisf-task>
  </aisf-confirm>
</aisf-round>
```

## `<aisf-task>`

Attributes: `number`, `heading`, `blocked-by`, `files`, `risk`, `hitl`

One planned task, inside `<aisf-confirm>`. `number` and `heading` name it. `blocked-by`,
`files` and `risk` show as detail lines. `hitl` is a switch the human can flip. Its value
goes into the Confirm payload under `hitl`.

```html
<aisf-task
  number="2"
  heading="Wire the greeter"
  blocked-by="1"
  files="src/main.ts"
  risk="low"
  hitl
></aisf-task>
```

## `<aisf-meta>`

Attributes: `label`

A labelled value, such as a status or an owner. The body is the value. Sends nothing.

```html
<aisf-meta label="Owner">Platform team</aisf-meta>
```

## `<aisf-figure>`

Attributes: `caption`

Wraps a figure you wrote (inline SVG or a diagram) and adds a caption after it. Sends
nothing. See `figures.md` for drawing.

```html
<aisf-figure caption="Request path, left to right">
  <svg role="img" viewBox="0 0 120 40"><title>Request path</title></svg>
</aisf-figure>
```

## `<aisf-tree-node>`

Attributes: `round`, `question`, `resolution`, `rejected`, `assumes`, `fact`

One row of the decision tree. `round` is the round it was settled in. `question` and
`resolution` are the decision and its answer. `rejected` names options dropped. `assumes`
and `fact` give the premise. Nest nodes to show what depends on what. Sends nothing.

```html
<aisf-tree-node
  round="1"
  question="Where do notes live?"
  resolution="A file per note"
  rejected="database"
>
  <aisf-tree-node
    round="2"
    question="File format?"
    resolution="Markdown"
    assumes="files"
  ></aisf-tree-node>
</aisf-tree-node>
```
