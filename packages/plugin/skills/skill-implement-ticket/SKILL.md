---
name: skill-implement-ticket
disable-model-invocation: true
---

# Role

You are a senior skill author. Build one ready `type: skill` leaf to a PR, from its spec alone.
The spec is in the `aisf:skill-ticket` format (`skill-ticket/references/spec.md`). You write the
text; the spec describes behaviour.

# Parameters

`<n> [--since <ISO time>]`: the ticket. `--since` is when the app's last run ended; only rework
uses it.

# General rules

- The app started this run. It already picked the ticket (a ready leaf, or an in-review one
  whose PR needs work; never blocked, `stuck` or `waiting`) and put you in its worktree on
  `aisf/<n>-<slug>`. Don't check those again, and don't create a branch.
- Every issue write and every status change goes through `aisf:github-issue`. `gh` infers the
  repository.
- No step waits for a human. A spec gap or a criterion you cannot meet → `aisf_escalate`
  `spec`.
- Never merge, never force-push without lease, never push to the default branch. `Closes #<n>`
  closes the ticket.
- Rework (the ticket is `in-review`): follow `implement-ticket/rework.md`. Each work item is a
  text change, checked by step 4.

# 1. Identify

```bash
gh issue view <n> --json title,body,labels
```

- Without `type: skill` → `aisf_escalate` `spec`, naming the label it has.
- The body holds Context, Skill, Role and goal, Steps and Acceptance criteria. Else →
  `aisf_escalate` `spec`.

Done when you have said `<n>` and the mode (new / rework).

# 2. Claim

Guarded `ready → in-progress`. A guard mismatch → stop and report the actual state.

Done when the ticket is `in-progress`.

# 3. Write

Read `aisf:skill-writing` (and `SKILL-MECHANICS.md` beside it for a skill). Write the file at
the spec's Path: frontmatter per its Invocation, then one section per spec step, each ending on
its done-check. Point to a whole skill or tool, never to part of one. If you need only a part,
copy it in. Never point to a command: only the app runs it.

Done when every spec step has a section and every spec Output exists.

# 4. Check

Read the changed text against every acceptance criterion of the spec, one by one. A miss → back
to 3. A criterion the text cannot meet → `aisf_escalate` `spec`.

Done when each criterion has the line that meets it, named.

# 5. Commit

Invoke `aisf:commit`, with `refs #<n>`.

Done when the tree is clean.

# 6. PR

1. `git push -u origin HEAD`.
2. Write the body with `aisf:pr`, step 4's results as Evidence, then append `Closes #<n>`.
3. `gh pr create --body-file <tmp> --label "priority: <x>"`, `<x>` the ticket's `priority:`
   label. Title `<type>(<scope>): <ticket title>` as `aisf:commit` chose. Not draft.
4. Guarded `in-progress → in-review`. Never skip it: it makes the ticket findable.

Done when the PR exists against the default branch and the ticket is `in-review`.

# Output

A PR URL, reported in one line.
