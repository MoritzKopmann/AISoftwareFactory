---
name: skill-implement-ticket
disable-model-invocation: true
---

# Role

You are a senior skill author. Build one ready `type: skill` leaf to a PR, from its spec alone.
The spec is in the `aisf:skill-ticket` format (`skill-ticket/references/spec.md`). You write the
text; the spec describes behaviour.

# Parameters

`<n> [--since <ISO time>]`: the ticket. If none, ask. `--since` is when the app's last run
ended; only rework uses it.

# General rules

- Every issue read and write and every status change goes through `aisf:github-issue`. `gh`
  infers the repository.
- Mode, escalate kinds and parking: the Stop points of `aisf:implement-ticket`. A spec gap or a
  criterion you cannot meet → `aisf_escalate` `spec`. Hand-run: say what is missing and stop.
- Never merge. `Closes #<n>` closes the ticket.
- No step waits for a human.
- The spec is the whole brief. Skills are named, never copied: point to them.

# 1. Identify

```bash
gh issue view <n> --json title,body,labels,state,parent,subIssues,blockedBy
```

- A leaf with `type: skill` and `status: ready` (new), `in-progress` (resume) or `in-review`
  (rework). Without `type: skill` → stop and name the skill it needs (`aisf:implement-ticket`,
  `aisf:ui-implement-ticket`, `aisf:spike`, `aisf:onboard-project`). A `waiting` label → stop.
- Parent, blocked and in-review: `aisf:implement-ticket` §1. Rework reads
  `implement-ticket/rework.md`.
- The body holds Context, Skill, Role and goal, Steps and Acceptance criteria. Else → `aisf_escalate` `spec`.

Done when you have said `<n>` and the mode (new / resume / rework, AFK / hand-run).

# 2. Claim and branch

Claim and branch per `aisf:implement-ticket` §3, status swaps through `aisf:github-issue`.
Rework: `rework.md` §3.

Done when the ticket is `in-progress` and you are on `aisf/<n>-*`.

# 3. Write

Read `writing-for-agents` (and `SKILL-MECHANICS.md` beside it for a skill). Write the file at
the spec's Path: frontmatter per its Invocation, then one section per spec step, each ending on
its done-check. Pointing to a skill replaces copying it. Rework: each work item is a text change.

Done when every spec step has a section and every spec Output exists.

# 4. Check

Read the changed text against every acceptance criterion of the spec, one by one. A miss → back
to 3. A criterion the text cannot meet → `aisf_escalate` `spec`.

Done when each criterion has the line that meets it, named.

# 5. Commit

Invoke `aisf:commit`, with `refs #<n>`.

Done when the tree is clean.

# 6. PR

Push (`git push -u origin HEAD`; rework: `rework.md` §10). Write the body with `aisf:pr`, the
check results of step 4 as Evidence, and append `Closes #<n>`. Create the PR per
`aisf:implement-ticket` §10. Then guarded `in-progress → in-review` through `aisf:github-issue`.

Done when the PR exists against the default branch and the ticket is `in-review`.

# Output

A PR URL, reported in one line.
