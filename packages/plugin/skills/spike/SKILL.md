---
name: spike
description: >
  Run a type: spike sub-issue posted by aisf:plan-ticket: build throwaway code that answers its
  question, write the verdict into the parent's "Planning so far", close the spike. No TDD, no
  PR. Use when the user wants to run a spike. Triggers: "spike #N", "run spike N".
---

# spike

Answer one spike ticket's question, so planning on its parent can go on. Argument: ticket
number. If none, ask.

`gh` infers the repository from the current checkout. Never pass `-R`. Every status change and
every issue write goes through `aisf:github-issue`.

## Stop points

Mode is **AFK** when the `aisf_escalate` tool is present, **hand-run** otherwise. Decide once.

AFK: A permission denial doesn't end your turn: the app asks the human. Told you may retry → issue the identical call once, unchanged. Otherwise carry on without it.

**escalate `denied`**: a call the work can't finish without was refused.

- AFK: `aisf_escalate({kind: 'denied', reason})`. The `reason` names the refused tool and its
  input. Escalation ends the run.
- Hand-run: say what was denied, ask.

Never call an `aisf_*` tool that isn't present.

## 1. Read

```bash
gh issue view <n> --json title,body,labels,state,parent
```

Go on only with an open `type: spike` ticket at `status: ready`, or `status: in-progress` to
resume, whose parent has a `## Planning so far` section. Anything else → stop, say why, write
nothing.

Take from the body: the options, and what result settles them.

## 2. Build

Branch `aisf/<n>-spike`. Already on `aisf/<n>-*` → stay. Otherwise, on a clean tree:
`git fetch origin && git switch -c aisf/<n>-spike origin/main`. A dirty tree → ask the human.
Never stash. Then guard `ready → in-progress`.

Build the least that produces the settling result. It is throwaway: no TDD, no review, no
project checks.

## 3. Verify

- **`hitl` label:** the human judges. Say how to start it and what to look at, then wait. Their
  answer is the evidence.
- **No `hitl`:** you judge. Run it and keep the output.

Never rate a result nobody saw. Stop when the result settles the options, or when it is clear it
won't: that is an `inconclusive` verdict, not a reason to keep building.

## 4. Verdict

Commit everything in one commit, `chore: spike #<n>`. Never push, no PR.

Insert into the parent's body, directly under `Waiting for the verdict of #<n>`:

    **Verdict:** the option chosen, or `inconclusive`.
    **Evidence:** what was built and run, and what it showed. On a `hitl` spike: what the human
    reported.
    **Caveats:** what the result does not cover.
    **Code:** local branch `aisf/<n>-spike`, not pushed.

**Inconclusive or failed** gets the full story under Evidence: what was tried, why it did not
settle the options, and what blocked it.

Then `gh issue close <n>`. Report the verdict and that `plan #<parent>` resumes from it. Don't
start planning yourself.
