## Body template

Step 3's reference.

Use this template for the PR body:

```markdown
## Summary

<diagram, diff-sketch, or tree>

## Evidence

- **Before:** <screenshot>
  **After:** <screenshot>

## Merge Danger

**Door:** <one-way or two-way>

<optional: description>

**Blast Radius:** <one-word description>

<optional: potential ramifications of merge>
```

## Sections

Skip all preambles and keep prose brief.

### Summary

Pick the smallest view that makes the key point clear.

- Pseudocode: logic or an algorithm.
- Call tree: runtime control flow.
- Component tree: UI structure, with the state and module boundaries that matter.
- Shallow file tree: file responsibility, or a broad refactor.
- Mermaid: interaction, control flow or data flow between parts.
- Diff: what changes when the surrounding shape exists. Diff the same view the topic uses.
- Whole block: mostly new, cut context would hide ownership or order, or the reader needs a copyable target.

Place each visual next to the text it supports. Keep only what the point needs. Use one or several views, rarely all.

### Evidence

Concrete evidence that the change works.

Screenshots are S-tier - when the environment is set up for it and the change is visual. Show Before and After.

Execution-based evidence is A-tier. Show the exact test that now fails and passes, using pseudocode, plus the verbatim command output. No Before/After pair needed.

### Merge Danger

Describe whether it's a one-way or two-way door. You can walk back through two-way doors, but not one-way doors. A PR that is cheap to roll back is lower risk. Changes that involve destructive actions or hard-to-reverse decisions are one-way doors.

The blast radius is the potential impact or scope of the changes introduced by this PR. Consider all possibilities. Examples are layout shift, breakages for consumers, mobile responsiveness, etc.
