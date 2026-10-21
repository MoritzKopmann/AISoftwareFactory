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

Attributes: `name`, `heading`, `assumes`, `problem`

One question. `name` is the key in the answer. `heading` is the question text. `assumes` names
what the question rests on. `problem` is one short line shown under the heading: what is
wrong today. Holds `<aisf-card>`, optional `<aisf-context>` and optional `<aisf-more>`. The kit adds an
Other choice with a text field and a Discuss choice with a note.

Sends no event itself. Its answer joins the round's Submit payload.

```html
<aisf-question name="retry" heading="Retry failed uploads?" assumes="uploads are idempotent">
  <aisf-card value="yes">Yes, three times</aisf-card>
  <aisf-card value="no">No</aisf-card>
</aisf-question>
```

## `<aisf-card>`

Attributes: `value`, `suggested`, `why`, `gain`, `cost`, `effect`

One choice. `value` is the answer sent. `suggested` marks the choice Accept all picks. `why`
is one short line shown with the suggestion. `gain` and `cost` are one short phrase each, shown
under the label. `effect` is one line of fact: what picking it builds or changes, shown after
cost. They never change the label or the answer. The body is the label: keep it short.

```html
<aisf-card
  value="queue"
  suggested
  why="Keeps requests fast"
  gain="fast replies"
  cost="more code"
  effect="adds a worker in runs · infrastructure, one more sub-issue"
  >Queue the work</aisf-card
>
```

## `<aisf-more>`

Attributes: none

Longer detail for a question. A child of `<aisf-question>`. Starts collapsed behind a More
button. Its text is never part of the answer or the frozen summary.

```html
<aisf-more>The queue needs a worker. It retries three times.</aisf-more>
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

## `<aisf-precedent>`

Attributes: none

Decisions settled by precedent, inside a round of questions. Each child with a `name` is one
decision: its text is the decision, `source` is its source line. Each gets a veto switch and,
once vetoed, an optional note. The round sends `vetoes` next to `answers`, only for vetoed
decisions, the note being `""` when none was typed. A round without this element sends no
`vetoes` key.

Submit payload: `{"answers":[…],"vetoes":{"<name>":"<note>"}}`.

```html
<aisf-precedent>
  <div name="p1" source="#12">Keep the old name</div>
</aisf-precedent>
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

## `<aisf-sequence>`

Attributes: none

A sequence diagram, drawn for you. Holds `<aisf-actor>` (one lifeline column each, in order) and
`<aisf-step>` (one arrow row each, in order). A step naming an actor you did not list adds it
as the last column, with a warning outline. Sends nothing.

```html
<aisf-sequence>
  <aisf-actor name="scheduler"></aisf-actor>
  <aisf-actor name="runner"></aisf-actor>
  <aisf-step from="scheduler" to="runner" mark="new">start(run)</aisf-step>
</aisf-sequence>
```

## `<aisf-actor>`

Attributes: `name`

One column of `<aisf-sequence>`. `name` is its heading and the value `from` and `to` use.
Draws nothing itself.

## `<aisf-step>`

Attributes: `from`, `to`, `mark`

One arrow, inside `<aisf-sequence>` or `<aisf-state>`. `from` and `to` name the ends. The body
is the label. `mark` is `new`, `changed` or `untouched`; leave it out for a plain arrow. Draws
nothing itself.

## `<aisf-state>`

Attributes: none

A lifecycle, drawn for you. Holds `<aisf-step>`. The states are the distinct `from` and `to`
values, in order of first appearance. Sends nothing.

```html
<aisf-state>
  <aisf-step from="ready" to="in-progress">claim</aisf-step>
  <aisf-step from="in-progress" to="ready">reset</aisf-step>
</aisf-state>
```

## `<aisf-modmap>`

Attributes: `layers`

A module × layer grid, drawn for you. `layers` lists the rows, space separated. Holds
`<aisf-unit>`. Modules are the columns, in order of first appearance. A unit naming a layer not
in `layers` adds a last row, with a warning outline. Sends nothing.

```html
<aisf-modmap layers="presentation business">
  <aisf-unit module="runs" layer="business" mark="changed">RunService</aisf-unit>
</aisf-modmap>
```

## `<aisf-unit>`

Attributes: `module`, `layer`, `mark`

One box of `<aisf-modmap>`. `module` picks the column, `layer` the row. The body is the label.
`mark` is `new`, `changed` or `untouched`. Draws nothing itself.
