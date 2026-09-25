# GitHub ticket-state detection and primitives

Research for [#3](https://github.com/MoritzKopmann/AISoftwareFactory/issues/3) (part of map [#1](https://github.com/MoritzKopmann/AISoftwareFactory/issues/1)).
It feeds [#7 ticket state machine](https://github.com/MoritzKopmann/AISoftwareFactory/issues/7) and [#9 app architecture](https://github.com/MoritzKopmann/AISoftwareFactory/issues/9).
Researched 2026-09-25 against github.com with `gh` 2.98.0. Every query marked **verified** was run against this repo or `MoritzKopmann/postkarte`.

## Answer

**Poll. Don't use webhooks. Build state on labels plus native relationships, not on Projects v2. Authenticate with the developer's existing `gh` token.**

- **Detection:** use a GraphQL **snapshot query** per repo as the source of truth. It costs 1 to 3 points and returns open issues with labels, parent, sub-issues, blocked-by/blocking and closing PRs. Trigger it with cheap **ETag polls** of two REST feeds, `issues?sort=updated` and `issues/events`. A `304` response doesn't count against the rate limit. Run a full snapshot every few minutes as a safety net. Expect about 10 to 15 s latency, a near-zero rate-limit cost, and no inbound networking.
- **Primitives:** `status:` labels hold the workflow status. Native **sub-issues** hold hierarchy. Native **blocked-by** holds ordering and replaces the `Depends on #N` body text. **`Closes #N`** links PRs to their issue (`closedByPullRequestsReferences`). The issue's **open/closed state** means done. Projects v2 needs extra token scopes, sends no webhooks for user-owned projects, and can't be reached by GitHub Apps on user-owned projects. It adds IDs to juggle and doesn't fix any problem we have.
- **Auth:** read `gh auth token` at startup, with an optional override by a fine-grained PAT. A GitHub App is overkill for a single-user local tool.

## 1. Detecting changes on the developer's machine

### Comparison

| Option | Latency | Rate-limit cost | Setup | Sees relationship changes? | Verdict |
|---|---|---|---|---|---|
| **GraphQL snapshot poll** (one query per repo) | the poll interval (30–60 s is fine) | 1–3 points/query (verified: 50 issues with all relationships = 3 points). At 60/h that's ≤180 of 5,000 pts/h | none | yes, it reads current state directly | **Use as the source of truth** |
| **REST ETag poll** of `GET /repos/{o}/{r}/issues?state=all&sort=updated` | poll interval (10–15 s ok) | **0** when unchanged (verified: 304s didn't move `X-RateLimit-Used`) | none | **no**: sub-issue/blocked-by/cross-reference changes don't bump `updated_at` (verified, see gotchas) | **Use as a trigger** (new issues, edits, labels, comments, close) |
| **REST ETag poll** of `GET /repos/{o}/{r}/issues/events` | poll interval | **0** when unchanged (verified) | none | **yes**: `sub_issue_added`, `parent_issue_added`, `blocked_by_added`, `blocking_added`, `labeled`, `unlabeled`, `closed`, and `merged` for PRs (verified) | **Use as a trigger** (relationship and merge changes) |
| Activity **Events API** `GET /repos/{o}/{r}/events` | "30s to 6h" per docs; `X-Poll-Interval: 60` | ETag-able | none | **no**: its `IssuesEvent` only carried `opened/labeled/assigned` here, not sub-issue/dependency changes | Don't use: too slow and incomplete |
| **`gh webhook forward`** (`cli/gh-webhook` extension) | ~real time | none | install the extension and keep one process per repo running | yes (`sub_issues`, `issue_dependencies` events exist) | Optional accelerator later, not the foundation (see below) |
| **Webhook through a tunnel** (ngrok, cloudflared, smee.io) | ~real time | none | tunnel account and process, a public URL, secret verification, and re-registering the hook when the URL changes | yes | No: too much setup and it exposes a public endpoint to a local tool |
| **GitHub App webhooks** | ~real time | none | an app registration, a private key, and still a public URL to receive deliveries | yes | No, for the same reason |

### Why polling rather than `gh webhook forward`

Here is how the extension works (read from its source, `webhook/create_webhook.go` and `forward.go`). It creates an inactive repo hook named `cli`, and GitHub returns a `ws_url`. The extension opens a websocket to that URL, then activates the hook. It relays each delivery to `--url` and retries when the server drops the connection (1006).

It doesn't fit as the foundation, for these reasons:

- The docs say: *"only designed for use during testing and development. It is not supported for use in production environments"* and *"Only one person can use webhook forwarding at a time for each repository"*.
- Events that happen while the app is down, or while the socket is reconnecting, are **lost**. So the app would need a poll-based reconciliation anyway, and the poll alone is enough.
- It needs a token that can admin repo hooks (org hooks need `admin:org_hook`), and it's one long-lived child process per repo.
- The `cli/gh-webhook` README is two lines long and has no stability promises. The repo was last pushed 2026-08-24.

AFK stages run for minutes, so 10 to 15 s of detection latency doesn't matter. If lower latency is ever wanted, `gh webhook forward` can be bolted on as a *trigger* for the same snapshot, while polling stays the reconciliation.

### Rate limits (docs, 2026-09)

| Budget | Limit |
|---|---|
| REST primary, user token (PAT / `gh` OAuth) | 5,000 req/h |
| GraphQL primary, user | 5,000 points/h (cost = connections requested ÷ 100, min 1; `first`/`last` must be 1–100; ≤500k nodes; 10 s timeout) |
| REST secondary | ≤100 concurrent; ≤900 points/min (GET 1, write 5); ≤80 content-creating req/min and ≤500/h |
| GraphQL secondary | ≤100 concurrent; ≤2,000 points/min |
| Conditional requests | *"does not count against your primary rate limit if a `304` response is returned and the request was made while correctly authorized"* (verified) |
| Guidance | make requests **serially** (a queue); wait ≥1 s between mutations |

GraphQL is POST-only and has **no ETag/304**, so every GraphQL poll costs points. That's the reason to put the free REST ETag polls in front of it.

### Recommended loop (per repo)

```
every 10–15 s:  GET issues?state=all&sort=updated&direction=desc&per_page=1   If-None-Match: <etag1>
                GET issues/events?per_page=1                                    If-None-Match: <etag2>
                any 200  -> run the snapshot query
every 5 min:    run the snapshot query anyway (safety net)
on startup:     run the snapshot query
after the app's own mutations: run the snapshot query
```

Worst case, with a change every tick and one repo: 2 × 360 REST + 360 × 3 GraphQL, which is far inside the budgets. With N repos, stagger the polls and keep one serial request queue.

## 2. Primitives

### What each gives us

| Primitive | Read (verified) | Write | Events | Token needs | Gotchas |
|---|---|---|---|---|---|
| **Labels** `status: backlog/ready/in-progress/in-review` | GraphQL `labels(first:20){nodes{name}}`; REST `labels[]`; filter `issues(labels:[...])` | `gh issue edit N --add-label … --remove-label …` | `issues.labeled/unlabeled` webhook; `labeled/unlabeled` issue events | `repo` / fine-grained Issues:write | Two labels can be set at once, so the app must enforce exclusivity. **Labels go stale on close**: merged postkarte issues #1307–1309 are CLOSED but still carry `status: in-review` (verified). Changes **do** bump `updated_at` (verified: postkarte #1310, #1306). |
| **Native sub-issues** | GraphQL `parent{number}`, `subIssues(first:100){nodes{number state}}`, `subIssuesSummary{total completed percentCompleted}`; REST `GET …/issues/N/sub_issues`, `GET …/issues/N/parent`, `sub_issues_summary` on the issue | `gh issue create --parent N`, `gh issue edit N --add-sub-issue 12,13` / `--parent` / `--remove-parent` (numbers, gh ≥2.98). REST `POST …/sub_issues {sub_issue_id}` takes the **issue `id`, not the number**. GraphQL `addSubIssue(issueId, subIssueId, replaceParent)`, `removeSubIssue`, `reprioritizeSubIssue` take node IDs | `sub_issues` webhook: `sub_issue_added/removed`, `parent_issue_added/removed` | same as issues | ≤100 sub-issues per parent, ≤8 levels. The sub-issue must share the parent's owner. Changes **don't bump `updated_at`** on either side (verified). One parent per issue (`replace_parent` to move). |
| **Native dependencies** (blocked-by) | GraphQL `blockedBy(first:N){nodes{number state}}`, `blocking(...)`, `issueDependenciesSummary{blockedBy totalBlockedBy blocking totalBlocking}`; REST `GET …/issues/N/dependencies/blocked_by` and `/blocking`, `issue_dependencies_summary` on the issue | `gh issue create --blocked-by 3`, `gh issue edit N --add-blocked-by 3 / --remove-blocked-by`. REST `POST …/dependencies/blocked_by {issue_id}` takes the **blocker's `id`**. GraphQL `addBlockedBy(issueId, blockingIssueId)`, `removeBlockedBy` | `issue_dependencies` webhook: `blocked_by_added/removed`, `blocking_added/removed` | same as issues | Changes **don't bump `updated_at`** (verified). `blockedBy` counts **open** blockers only and `totalBlockedBy` counts all of them (verified by closing #3: see appendix). The UI shows a "Blocked" icon. |
| **PR ↔ issue link** | Issue: `closedByPullRequestsReferences(first:5, includeClosedPrs:true){nodes{number state}}`. PR: `closingIssuesReferences(first:5){nodes{number}}` (verified on postkarte PRs #1316–1318). Search `linked:pr` | A closing keyword (`Closes #N`) in the PR body, or a manual link in the sidebar. **`refs #N` in commits doesn't link** | `pull_request` webhook; `merged`/`closed` for PRs in `issues/events` (verified) | same | The issue only auto-closes when the PR merges into the **default branch**. `cross-referenced` timeline events also don't bump `updated_at`. |
| **Issue state** | `state` OPEN/CLOSED, `stateReason` COMPLETED/NOT_PLANNED/DUPLICATE | `gh issue close/reopen` | `issues.closed/reopened` | same | This is the only reliable "done" signal. |
| **Projects v2 Status field** | `projectItems(first:10){nodes{ fieldValueByName(name:"Status"){ ... on ProjectV2ItemFieldSingleSelectValue{ name optionId } } }}` (docs, **not verified**, see token column) | `updateProjectV2ItemFieldValue(projectId, itemId, fieldId, value:{singleSelectOptionId})`: 4 opaque IDs per write; or `gh project item-edit` | `projects_v2_item` webhook exists **for organizations only**, so a user-owned project sends none | **`read:project` / `project` scope**, which the default `gh` token doesn't have (verified: `INSUFFICIENT_SCOPES`). GitHub Apps can't access user-owned projects, and fine-grained PAT support for user projects is patchy | A per-project board config (field IDs, option IDs). Status lives outside the repo. Built-in project workflows can auto-set Done on close. |
| Issue types / issue fields | `issueType{name}`; `IssueFilters.type`, `issueFieldValues`; search `type:`, `field.x:` | org settings | `issues.typed`, `field_added` | — | **Org-owned repos only.** `issueType` is `null` here. Not usable for personal repos like postkarte. |

### Search qualifiers are unreliable for state (verified)

| Query (`gh issue list --search`) | Result on this repo | Correct? |
|---|---|---|
| `is:blocked` | 6–11 | yes |
| `is:blocking` | 2–6 | yes |
| `has:parent-issue` / `no:parent-issue` | 2–11 / 1 | yes |
| `has:sub-issues` | 1–11 | **no** (ignored) |
| `no:sub-issues` | 1–11 | **no** |
| `has:sub-issue` | 1 | yes, singular only |
| `parent-issue:MoritzKopmann/AISoftwareFactory#1`, `blocked-by:3` | empty | **no** |

The search index is also eventually consistent. **Don't derive workability from search.** Read the fields.

### Verified snapshot query (cost 3 points for 50 issues)

```graphql
query($owner:String!,$name:String!){
  rateLimit{cost remaining resetAt}
  repository(owner:$owner,name:$name){
    issues(first:50, states:[OPEN], orderBy:{field:UPDATED_AT,direction:DESC}){
      pageInfo{hasNextPage endCursor}
      nodes{
        number state stateReason updatedAt
        labels(first:20){nodes{name}}
        parent{number}
        subIssuesSummary{total completed percentCompleted}
        subIssues(first:50){nodes{number state}}
        blockedBy(first:20){nodes{number state}}
        blocking(first:20){nodes{number state}}
        issueDependenciesSummary{blockedBy totalBlockedBy blocking totalBlocking}
        closedByPullRequestsReferences(first:5, includeClosedPrs:true){nodes{number state}}
      }
    }
  }
}
```

```bash
gh api graphql -F query=@snapshot.graphql -f owner=MoritzKopmann -f name=AISoftwareFactory
```

Excerpt of the result for #7 (before #3 closed):
`{"number":7,"parent":{"number":1},"blockedBy":{"nodes":[{"number":3,"state":"OPEN"}]},"issueDependenciesSummary":{"blockedBy":1,"totalBlockedBy":1,...}}`

### Other verified REST calls

```bash
gh api repos/O/R/issues/1/sub_issues --jq '.[] | [.id,.number,.state] | @tsv'       # id is 5585652061 for #3, not 3
gh api repos/O/R/issues/7/dependencies/blocked_by --jq '.[].number'                  # 3
gh api repos/O/R/issues/3/dependencies/blocking --jq '.[].number'                    # 7 9
gh api repos/O/R/issues/3/parent --jq .number                                        # 1
gh api repos/O/R/issues/7 --jq '{sub_issues_summary, issue_dependencies_summary}'
gh api -i -H 'If-None-Match: W/"<etag>"' 'repos/O/R/issues/events?per_page=1'       # HTTP 304, X-RateLimit-Used unchanged
```

Note: `gh api` **exits non-zero on 304** (`gh: HTTP 304`). The app should treat that as "unchanged", or call the REST API with its own HTTP client.

### Proposed mapping for the state machine (input to #7)

| Derived state | Rule |
|---|---|
| done | `state == CLOSED`. Ignore labels on closed issues. |
| blocked | open and `issueDependenciesSummary.blockedBy > 0` |
| container | `subIssuesSummary.total > 0`: work its open, unblocked sub-issues in `subIssues` order; close the parent when `completed == total` |
| needs create/grill (HITL) | `status: backlog`, no Dev Notes |
| workable → plan | `status: backlog`, settled (the rule for "settled" is #7's call) |
| workable → implement | `status: ready`, not blocked, no sub-issues |
| running / claimed | `status: in-progress` (the app sets it *before* launching, so the label doubles as a claim) |
| in review | `status: in-review` and/or `closedByPullRequestsReferences` has an OPEN PR |

## 3. Auth for a single-user local tool

| Option | Setup | Scope / reach | Expiry | Projects v2 | Fit |
|---|---|---|---|---|---|
| **`gh auth token`** (OAuth app token, here `repo, read:org, gist, admin:public_key`) | none. The developer is already logged in, and Claude Code sessions use the same `gh` | every repo the user can reach (broad) | none until revoked | needs `gh auth refresh -s project` | **Best for v1.** Zero setup, and the same identity the stages already use |
| **Fine-grained PAT** | create in the UI, pick repos and permissions (Issues RW, Pull requests RW, Contents RW, Metadata R) | only the selected repos, least privilege | mandatory expiry (rotation chore) | user-owned projects are unreliable | Good as an optional override for people who want least privilege |
| **Classic PAT** | create in the UI | as broad as `gh` | optional | `project` scope | No advantage over `gh` |
| **GitHub App** | register the app, private key, install on repos, mint 1 h installation tokens (JWT) | per-install, fine-grained; acts as a bot | 1 h tokens | **can't access user-owned projects** | Overkill for single user. Its only perk (webhooks) still needs a public URL. Bot attribution would confuse "who did this". |

**Recommendation:** at startup, run `gh auth token` (or honor `GH_TOKEN` / `GITHUB_TOKEN`, then an optional configured fine-grained PAT). Check the scopes from the `X-OAuth-Scopes` header on the first response. Point the user to `gh auth login` if it's missing. Never store the token.

## Open risks

1. **Relationship edits don't bump `updated_at`.** An updated-since poll alone misses a human adding a blocker in the UI. Mitigations: the `issues/events` ETag trigger plus the periodic full snapshot.
2. **No "issue created" in `issues/events`.** New issues are caught by the `issues?sort=updated` feed, which is why there are two triggers.
3. **Issue comments** (possibly used for HITL answers) aren't issue events. They do bump `updated_at`. If comments must be read, add `GET issues/comments?since=…` with an ETag.
4. **Label exclusivity is convention only.** Two agents or a human can leave two `status:` labels. The app must normalise, and the state machine must define precedence.
5. **Stale labels after close** (observed on postkarte). The state machine must key "done" on `state`, not labels.
6. **Search qualifier drift.** Relationship qualifiers are partly undocumented and some are ignored. Don't depend on them.
7. **ID vs number.** REST sub-issue/dependency writes take the internal `id`, and GraphQL takes node IDs. `gh issue edit/create` ≥2.98 accepts numbers, so skills should use the `gh` flags and not raw `gh api` POSTs.
8. **Multiple repos:** one serial request queue across repos keeps the app under the secondary limits (100 concurrent, 900 REST pts/min, 2,000 GraphQL pts/min).
9. **`gh webhook forward` stability:** it's a thin extension marked "testing only". Only adopt it as an optional accelerator.
10. **The `Depends on #N` body text has to migrate.** plan-ticket/implement-ticket should switch to `gh issue create --parent N --blocked-by M` and read `blockedBy`. A text-parsing fallback is needed for existing postkarte tickets, or they need a one-off migration.

## Appendix: close experiment

Closing #3 at the end of this research served as a live test. #3 blocks #7 and #9. #9 is also blocked by #2, which closed around the same time. Results (verified 2026-09-25 16:47Z):

| Check | Before close | After close |
|---|---|---|
| #7 `issue_dependencies_summary` | `blocked_by:1, total_blocked_by:1` | `blocked_by:0, total_blocked_by:1`: **`blocked_by` counts open blockers only** |
| #9 `issue_dependencies_summary` | — | `blocked_by:0, total_blocked_by:2` |
| #3 (the closed blocker) | `blocking:2` | `blocking:2, total_blocking:2`: counts the open dependents |
| #7 `updated_at` | 16:38:10Z | 16:38:10Z: **dependents aren't touched when a blocker closes** |
| #3 `updated_at` | 16:39:05Z | 16:46:52Z (bumped by the close) |
| `issues/events` with the old ETag | 304 | **200**, and the newest event is `closed` on #3 |
| `is:blocked` search | 6–11 | 6, 11: #7 dropped out right away |

Consequence: "blocked" must come from `issueDependenciesSummary.blockedBy` (or the blockers' states) in a fresh snapshot, never from a cached dependent. A blocker closing is visible only on the blocker itself and in the events feed.

## Sources

- REST rate limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- REST best practices (conditional requests, serial requests): https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
- GraphQL rate and query limits: https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api
- Sub-issues REST: https://docs.github.com/en/rest/issues/sub-issues
- Issue dependencies REST: https://docs.github.com/en/rest/issues/issue-dependencies
- Adding sub-issues (limits): https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/adding-sub-issues
- Creating issue dependencies: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies
- Filtering and searching issues: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests
- Activity Events API (latency 30 s–6 h): https://docs.github.com/en/rest/activity/events
- Webhook events and payloads (`sub_issues`, `issue_dependencies`, `projects_v2_item` org-only): https://docs.github.com/en/webhooks/webhook-events-and-payloads
- `gh webhook forward`: https://docs.github.com/en/webhooks/testing-and-troubleshooting-webhooks/using-the-github-cli-to-forward-webhooks-for-testing and source https://github.com/cli/gh-webhook
- Fine-grained PATs and user-owned Projects: https://github.com/orgs/community/discussions/156512, https://github.com/orgs/community/discussions/36441
- Linking a PR to an issue: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue
