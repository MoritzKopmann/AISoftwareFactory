# Dense but readable tool UIs: what high-trust sources recommend

Research for #106. Question: what do design systems (GitHub Primer, Atlassian, IBM Carbon), Linear's and Vercel's published guidance, NN/g and WCAG 2.2 recommend for dense but readable tool UIs? This covers status boards, developer dashboards, status marking, and the loading, empty, error, stale and too-much-data states, including their copy.

Researched 2026-09-28. Each guideline has an ID (for example `G-STATUS-2`) so later decisions can cite it. Quotes are verbatim from the source they link to. **Derived** marks a guideline that no single source states outright. It is put together from the cited ones.

## Sources

| Key | Source |
| --- | --- |
| WCAG-141 | [WCAG 2.2 Understanding 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) |
| WCAG-143 | [WCAG 2.2 Understanding 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) |
| WCAG-1410 | [WCAG 2.2 Understanding 1.4.10 Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html) |
| WCAG-1411 | [WCAG 2.2 Understanding 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) |
| WCAG-2411 | [WCAG 2.2 Understanding 2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) |
| WCAG-258 | [WCAG 2.2 Understanding 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) |
| WCAG-333 | [WCAG 2.2 Understanding 3.3.3 Error Suggestion](https://www.w3.org/WAI/WCAG22/Understanding/error-suggestion.html) |
| WCAG-413 | [WCAG 2.2 Understanding 4.1.3 Status Messages](https://www.w3.org/WAI/WCAG22/Understanding/status-messages.html) |
| APG-DISC | [WAI-ARIA APG: Disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) |
| CARBON-STATUS | [Carbon: Status indicators pattern](https://carbondesignsystem.com/patterns/status-indicator-pattern/) ([source mdx](https://github.com/carbon-design-system/carbon-website/tree/main/src/pages/patterns/status-indicator-pattern)) |
| CARBON-EMPTY | [Carbon: Empty states pattern](https://carbondesignsystem.com/patterns/empty-states-pattern/) |
| CARBON-LOAD | [Carbon: Loading pattern](https://carbondesignsystem.com/patterns/loading-pattern/) |
| CARBON-OVERFLOW | [Carbon: Overflow content pattern](https://carbondesignsystem.com/patterns/overflow-content/) |
| CARBON-NOTIF | [Carbon: Notifications pattern](https://carbondesignsystem.com/patterns/notification-pattern/) |
| CARBON-TABLE | [Carbon: Data table, style](https://carbondesignsystem.com/components/data-table/style/) and [usage](https://carbondesignsystem.com/components/data-table/usage/) |
| PRIMER-LOAD | [Primer: Loading](https://primer.style/product/ui-patterns/loading/) |
| PRIMER-EMPTY | [Primer: Empty states](https://primer.style/product/ui-patterns/empty-states/) |
| PRIMER-DEGRADED | [Primer: Degraded experiences](https://primer.style/product/ui-patterns/degraded-experiences/) |
| PRIMER-PD | [Primer: Progressive disclosure](https://primer.style/product/ui-patterns/progressive-disclosure/) |
| PRIMER-LABEL-A11Y | [Primer: Label, accessibility](https://primer.style/product/components/label/accessibility/) |
| PRIMER-STATELABEL | [Primer: StateLabel](https://primer.style/product/components/state-label/) |
| PRIMER-RELTIME | [Primer: RelativeTime](https://primer.style/product/components/relative-time/) |
| PRIMER-TYPE | [Primer: Typography](https://primer.style/product/getting-started/foundations/typography/) |
| ATL-LOZENGE | [Atlassian: Lozenge usage](https://atlassian.design/components/lozenge/usage) |
| ATL-ERROR | [Atlassian: Error messages](https://atlassian.design/foundations/content/designing-messages/error-messages) |
| ATL-EMPTY | [Atlassian: Empty state messages](https://atlassian.design/foundations/content/designing-messages/empty-state) |
| ATL-SPACE | [Atlassian: Spacing](https://atlassian.design/foundations/spacing) |
| ATL-TYPE | [Atlassian: Typography](https://atlassian.design/foundations/typography) |
| GH-BOARD | [GitHub Docs: Customizing the board layout (Projects)](https://docs.github.com/en/issues/planning-and-tracking-with-projects/customizing-views-in-your-project/customizing-the-board-layout) |
| LINEAR-2024 | [Linear: How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui) |
| LINEAR-2026 | [Linear: A calmer interface for a product in motion](https://linear.app/now/behind-the-latest-design-refresh) (Mar 2026) |
| VERCEL | [Vercel: Web Interface Guidelines](https://vercel.com/design/guidelines) |
| NNG-HSCROLL | [NN/g: Beware horizontal scrolling and mimicking swipe on desktop](https://www.nngroup.com/articles/horizontal-scrolling/) |
| NNG-ACCORDION | [NN/g: Accordions on desktop](https://www.nngroup.com/articles/accordions-on-desktop/) |
| NNG-TABLES | [NN/g: Data tables](https://www.nngroup.com/articles/data-tables/) |
| NNG-DASH | [NN/g: Dashboards: making charts and graphs easier to understand](https://www.nngroup.com/articles/dashboards-preattentive/) |
| NNG-IND | [NN/g: Indicators, validations, and notifications](https://www.nngroup.com/articles/indicators-validations-notifications/) |
| NNG-STATUS | [NN/g: Visibility of system status (heuristic #1)](https://www.nngroup.com/articles/visibility-system-status/) |
| NNG-ERROR | [NN/g: Error-message guidelines](https://www.nngroup.com/articles/error-message-guidelines/) |
| NNG-EMPTY | [NN/g: Designing empty states in complex applications](https://www.nngroup.com/articles/empty-state-interface-design/) |
| NNG-SKEL | [NN/g: Skeleton screens 101](https://www.nngroup.com/articles/skeleton-screens/) |
| NNG-PROG | [NN/g: Progress indicators make a slow system less insufferable](https://www.nngroup.com/articles/progress-indicators/) |
| NNG-STICKY | [NN/g: Sticky headers](https://www.nngroup.com/articles/sticky-headers/) |

---

## 1. Status boards and kanban-style rows

**G-BOARD-1: Put the count and the label in the group header.** GitHub Projects boards show "the current count of cards and the column's limit … at the top of the column". The count "highlights when exceeded" if a limit is set (GH-BOARD). Grouping creates "horizontal sections" by field value (GH-BOARD). So one full-width row per group has direct precedent.

**G-BOARD-2: Keep group labels whole. Truncate item titles, not headers.** Carbon: truncation "should **not** be used on page headers, titles, labels, error messages, validation messages, or notifications". When item text is truncated, it "always include[s] a browser tooltip on hover to show the entire string", keeps at least four visible characters, and hides at least three (CARBON-OVERFLOW). Atlassian lozenges cap at 200px, and because "Lozenges can't be focused, … truncated text will not be visible" (ATL-LOZENGE). Keep status labels short.

**G-BOARD-3: Sideways-scrolling strips are a weak pattern. If you use one, give it strong signifiers and another way in.** NN/g found horizontal scrolling on desktop gets consistently negative responses. The problems are a high interaction cost and content users don't expect. Also, "even strong cues such as arrows frequently remain unnoticed" (NNG-HSCROLL). If a strip is used, the required signifiers are: arrows that are always visible (not only on hover), items cut off at the edge, a scrollbar or position indicator, keyboard support, and an alternative such as a menu or "see all" (NNG-HSCROLL). "Don't force users to 'swipe' through your content: some will, many won't." (NNG-HSCROLL).

**G-BOARD-4: A board may scroll in two dimensions, but only the board itself.** WCAG 1.4.10 Reflow exempts "parts of the content which require two-dimensional layout for usage or meaning". Data tables are one example. But the exemption "does not automatically extend to other content": headings, search fields and controls must still reflow at 320 CSS px (WCAG-1410).

**G-BOARD-5: Collapse only when users need a subset. Show a chevron and text.** NN/g: accordions help "when users need only a few pieces of information". When "users require the majority or all the content", show everything, because "excessive clicking interrupts people's interaction" (NNG-ACCORDION). Signifiers: "the caret and the plus work best", and both the heading and the icon should be clickable (NNG-ACCORDION). Primer: a chevron rotates to show collapsed or expanded, and "Pair progressive disclosure icons with descriptive text" such as "Show more" (PRIMER-PD). Build it as a `button` with `aria-expanded` true/false, toggled with Enter or Space (APG-DISC).

**G-BOARD-6: Use "Show more" / "Load more" for long groups rather than fades.** Carbon: a "Show more" button is "used in place of scrolling, gradients, or fades as they are more prominent and actionable". "Load more" is the variant to use when performance matters (CARBON-OVERFLOW, CARBON-LOAD).

**G-BOARD-7: Keep sticky headers small and opaque.** Sticky headers should "maximize the content-to-chrome ratio by keeping it small". They should be opaque and clearly set apart from the content, with little or no animation (NNG-STICKY). For a big table, freeze the headers so users "always know what they're looking at" (NNG-TABLES). A sticky element must never fully cover the focused element (WCAG-2411).

**G-BOARD-8: Consolidated status takes the most severe member's colour.** "If the statuses of underlying components are green, yellow, and red, the consolidated indicator should be red" (CARBON-STATUS). This applies to collapsed-group summaries.

## 2. Developer dashboards: density, type, spacing, hierarchy

**G-DENSE-1: Pick a row height from a known ladder.** Carbon's table row sizes are 24 / 32 / 40 / 48 / 64 px (xs to xl). Extra large is "only recommended if your data is expected to have two lines of content in a single row". Header rows match body rows (CARBON-TABLE). Carbon's dense table text is 14px regular, column headers are 14px semibold, and column padding is 16px (CARBON-TABLE).

**G-DENSE-2: Use a 14px body size for dense product UI and 16px for long reading.** Atlassian: Body M, 14px with a 20px line height, "is the default size in components or where space is limited". Body L (16px) is for long-form text and Body S (12px) for secondary text. Tokens are in rem so users can resize (ATL-TYPE). Primer keeps line lengths "around 80 characters or less" and does not rely on colour for emphasis (PRIMER-TYPE).

**G-DENSE-3: Build spacing on 4/8 px multiples. Group by proximity and rank by scale and whitespace.** Atlassian's base unit is 8px. Small spacing (0–8px) is for compact UI such as gaps between an icon and its text or badge padding. Medium (12–24px) is for components. Large (32–80px) is for page structure. "Elements that are placed close to one another are assumed to be related." "Use scale and whitespace to rank elements" (ATL-SPACE).

**G-DENSE-4: Build hierarchy by dimming the chrome, not by adding decoration.** Linear (2026): "Don't compete for attention you haven't earned". The sidebar was made "a few notches dimmer" so the work area wins. "Structure should be felt not seen": fewer and softer separators, fewer and smaller icons, no unnecessary coloured backgrounds, density kept (LINEAR-2026). Linear (2024) cut visual noise and raised "the hierarchy and density of navigation elements", aligning labels and icons carefully. It also cut chroma for a neutral look (LINEAR-2024).

**G-DENSE-5: Align everything on purpose. Use tabular numerals for counts.** "Every element aligns with something intentionally" (VERCEL). "Use `font-variant-numeric: tabular-nums` or a monospace" for numbers that get compared (VERCEL). Carbon: when icons or shapes are stacked, keep them left-aligned with their text, and put shape indicators *before* labels (CARBON-STATUS).

**G-DENSE-6: Few indicators. Plain text when no action is needed.** "Avoid using status indicators when no user action is required … use plain text". "More than five or six indicators can overwhelm users" (CARBON-STATUS). NN/g: indicators add visual clutter, so weigh importance and frequency first (NNG-IND). Dashboards should be glanceable, and "color should only be used to reinforce information that is already communicated in a different way" (NNG-DASH).

**G-DENSE-7: Design every density, not just the happy path.** "All states designed: Empty, sparse, dense, & error states" (VERCEL).

**G-DENSE-8: Size targets and scale text for accessibility.** Pointer targets should be at least 24×24 CSS px, or spaced so that 24px circles around them don't overlap (WCAG-258). Text needs 4.5:1 contrast, or 3:1 for large text (at least 18pt, or 14pt bold) (WCAG-143).

## 3. Status marking: colour plus a non-colour cue

**G-STATUS-1: Never use colour alone.** "Color is not used as the only visual means of conveying information" (WCAG-141). Primer: colour-variant differences "are purely visual … They also won't be perceived by screen reader users". So the text itself must carry the meaning, e.g. "Pass: …" / "Fail: …" (PRIMER-LABEL-A11Y). Vercel: "Redundant status cues—Don't rely on color alone; include text labels" (VERCEL). Atlassian lozenges: pair colour "with clear labels and supporting icons" (ATL-LOZENGE).

**G-STATUS-2: Use at least two of colour, shape and symbol, plus a text label.** Carbon: indicators "should rely on at least two of the following elements: color, shape, or symbol". Elsewhere, "for WCAG compliance, at least three of these elements must be present" among symbol, shape, colour and type (CARBON-STATUS). Shape-only indicators "don't have the added recognition of an icon, therefore, it's important that they are paired with a status label" (CARBON-STATUS). Primer StateLabel pairs an icon, text and a semantic colour for issue and PR states (PRIMER-STATELABEL).

**G-STATUS-3: Meet 3:1 for status graphics and 4.5:1 for status text.** Status icons without text must reach 3:1 against their surroundings. The example given is "Status icons on an application's dashboard (without associated text)" (WCAG-1411). Carbon asks for 3:1 between status colours *and* between each indicator and the page, so statuses stay distinguishable "even in grayscale" (CARBON-STATUS). Label text needs 4.5:1 (PRIMER-LABEL-A11Y, WCAG-143).

**G-STATUS-4: Keep status colour meanings conventional and don't reuse a shape in several colours.** Carbon's palette: red = danger/error, orange = serious warning, yellow = warning, green = success/normal, blue = passive info or workflow progress, gray = draft or not started, purple = outliers or undefined (CARBON-STATUS). "Consider avoiding the use of the same shape with different colors within the same experience" (CARBON-STATUS). Use semantic colours for shared meaning such as status, and accent colours only for labels users choose (ATL-LOZENGE).

**G-STATUS-5: Grade by severity.** High attention means immediate action is needed (errors). Medium means no immediate action is needed (progress). Low means something is ready or has changed (CARBON-STATUS). Match how prominent a message is to how big the problem is (NNG-ERROR).

**G-STATUS-6: Label case.** Atlassian: "Only capitalize the first letter of the label" (ATL-LOZENGE). Vercel uses Title Case for headings and buttons (VERCEL). No accessibility rule forbids uppercase. It is a legibility and style choice (**Derived**: WCAG 2.2 has no such criterion).

## 4. States and their copy

### Loading

**G-LOAD-1: Show nothing for waits under about 1 s. Delay the indicator, then keep it up long enough.** Under 1 s, "Seeing a loading indicator flash on the screen could be distracting" (PRIMER-LOAD). NN/g says the same (NNG-SKEL, NNG-PROG). Vercel: a "short show-delay (~150–300 ms) & a minimum visible time (~300–500 ms) to avoid flicker" (VERCEL).

**G-LOAD-2: Match the indicator to the duration.** 1–3 s: indeterminate. 3–10 s: determinate. Over 10 s: determinate, and think about running it in the background (PRIMER-LOAD). NN/g: 2–10 s calls for a spinner or skeleton, and over 10 s a progress bar is "strongly recommended" (NNG-SKEL).

**G-LOAD-3: Skeletons mirror the real layout, and only for containers.** Skeletons suit large areas (PRIMER-LOAD). Use skeletons of the real content, not of the frame (NNG-SKEL). "Skeletons mirror final content exactly to avoid layout shift" (VERCEL). Use skeletons only for container or data components such as tables, tiles and lists, not for buttons, toasts or menus (CARBON-LOAD). For dashboards fed by several sources, load progressively: structure first (CARBON-LOAD).

**G-LOAD-4: Name what is loading, and announce it.** Write "loading status checks" rather than "loading" (PRIMER-LOAD). Loading text ends with an ellipsis: "Loading…" (VERCEL). Set `aria-busy="true"` while updating and announce results with `role="status"` (PRIMER-LOAD). WCAG 4.1.3 counts the busy state and results counts as status messages that must be announced without taking focus (WCAG-413).

### Empty

**G-EMPTY-1: Say why it's empty and give a next step. No blank screens and no dead ends.** "Never leave screens completely blank". For example, "There are no records to display for the selected date range" (NNG-EMPTY). Don't claim there is nothing while it is still loading (NNG-EMPTY). "Every screen offers a next step or recovery path" (VERCEL).

**G-EMPTY-2: Structure: title, one line of body text, one action.** Primer's Blankslate is an optional graphic, then primary text as the title, then short secondary text so "users should be able to understand what steps they might take next", then one primary action and an optional "Learn more" link (PRIMER-EMPTY). Atlassian: one to two sentences. The CTA is an imperative verb of one or two words (ATL-EMPTY). Carbon: a positive title ("Start by adding data assets") and one focused action. Don't cover several options or use jargon (CARBON-EMPTY).

**G-EMPTY-3: Tell the empty-state kinds apart.** They are: no data yet (first use); a result of user action (no search results, done); and an error (permissions, system issue, configuration required) (CARBON-EMPTY). Primer separates new, temporarily empty and error cases, and error cases get an alert icon rather than a playful graphic (PRIMER-EMPTY). "Temporarily empty" should read as expected, not as a failure (PRIMER-EMPTY). When nothing needs attention, extra text is unnecessary (CARBON-EMPTY).

**G-EMPTY-4: In dense layouts, the empty state replaces the element, as text only, with a quiet action.** "Empty states should replace the element that would ordinarily show", so there are no orphan headers. When several empty states can appear at once, use text only and a tertiary button, so there aren't several primary buttons (CARBON-EMPTY). In small spaces, "use just text" (CARBON-EMPTY).

### Error

**G-ERR-1: Name the fix.** "Error messages guide the exit. Don't just state what went wrong—tell the user how to fix it." Example: "Your API key is incorrect or expired. Generate a new key in your account settings." (VERCEL). WCAG 3.3.3: when a correction is known, offer it (WCAG-333). NN/g: "precise descriptions" and "constructive advice", with the message placed near its source (NNG-ERROR). Nielsen, as quoted by Carbon: "plain language (no codes), precisely indicate the problem, and constructively suggest a solution" (CARBON-EMPTY).

**G-ERR-2: Copy structure and tone.** Atlassian: an optional title of 3–4 words. The body is 1–2 sentences covering "the reason for the error and the problem, how someone should act and what happens if they don't act". "Avoid using 'please' and 'sorry'". Don't blame: use "we", not "you". "If you don't know the reason for an error, don't make one up – just say that something's gone wrong and offer a solution." (ATL-ERROR). Carbon's error table pairs "why there is no data" with "what the user can do" for permissions, system issues and configuration (CARBON-EMPTY). Buttons say the action ("Save API Key", not "Continue") (VERCEL).

**G-ERR-3: A partial failure degrades gracefully and doesn't hide the problem.** "Don't try to conceal or downplay that something is wrong." When a failure hits several areas, use a global warning banner. For small areas use an inline message with a warning icon, and for panels use a Blankslate. Hide counts you can't get rather than showing placeholders. Too many warning-coloured messages make the page "feel broken instead of degraded" (PRIMER-DEGRADED). Don't disable controls because of availability problems (PRIMER-DEGRADED). Banners stay until dismissed. Inline notifications stay until resolved (CARBON-NOTIF).

### Stale

**G-STALE-1: Show how fresh the data is as a timestamp, with the absolute time available.** Keeping users informed "through appropriate feedback within reasonable time" is heuristic #1 (NNG-STATUS). Primer RelativeTime shows relative time for recent dates (default threshold 30 days, absolute after that) and carries the full timestamp in a `title` or tooltip by default (PRIMER-RELTIME). Format dates for the user's locale (VERCEL). **Derived**: none of the sources above defines a specific "stale data" pattern. Combining NNG-STATUS, PRIMER-RELTIME and PRIMER-DEGRADED gives this: show "Updated 3 min ago" (relative, with the absolute time on hover) next to data that comes from a poll. When a refresh fails, keep the last good data, mark it with a warning icon and text ("Couldn't refresh; showing data from 10:42. Retrying in 30 s" or "Check your network / gh auth"), and don't blank it out.

**G-STALE-2: Announce refresh results politely.** Updates that don't change context go through `role="status"` or `aria-live`, not focus changes (WCAG-413).

### Too much data

**G-MUCH-1: Show more or load more, with counts.** Carbon: "Show more" or "Load more" rather than fades or endless scroll (CARBON-OVERFLOW). Use pagination when there is too much to show at once (CARBON-TABLE). Put the total in the group header (GH-BOARD). Results counts are status messages ("5 results returned") (WCAG-413).

**G-MUCH-2: Filter or slice rather than cram.** GitHub Projects offers slicing by field value in a side panel and hiding columns (GH-BOARD). NN/g recommends hiding and reordering columns "with low interaction cost" and clear hidden-state indicators (NNG-TABLES).

**G-MUCH-3: Truncate item text with a way to see all of it.** See G-BOARD-2. Use front or middle truncation when strings share a prefix or suffix, e.g. IDs or paths (CARBON-OVERFLOW).

**G-MUCH-4: Keep state in the URL.** "Persist state in the URL so share, refresh, Back/Forward navigation work" (VERCEL). This covers filters and expanded or collapsed groups.

---

## Implications for aisf

These are options for later decisions, not settled choices.

1. **Board rows.** Keep one full-width row per status (precedent: GH-BOARD grouping). The row header shows the status label in full (never truncated), plus a count in tabular numerals (G-BOARD-1/2, G-DENSE-5). Drafting's uppercase mono label is fine for short status names (G-STATUS-6). Keep it short and whole.
2. **Avoid a sideways strip as the main way to reach cards.** With 10–11 statuses, most rows hold only a few tickets. Prefer wrapping cards in the row, or a "Show N more" button after a cap (G-BOARD-3, G-BOARD-6, G-MUCH-1). If a strip is kept, it needs always-visible arrows, a cut-off edge card, keyboard scrolling and a "see all" (NNG-HSCROLL).
3. **Collapsing.** Empty rows (count 0) can collapse to a single header line. `closed` can start collapsed, since users rarely need it. The active statuses (ready, in-progress, in-review, stuck, conflict) stay open (G-BOARD-5). Use a chevron plus text, a `button[aria-expanded]`, and remember the state in the URL (G-MUCH-4).
4. **Status marking.** Every status is shown as text plus at least one non-colour cue: an icon or shape before the label, left-aligned (G-STATUS-2, G-DENSE-5). Attention statuses (stuck, conflict) get a symbol, not only red. The hitl flag should be an icon plus the text "HITL", not only purple. A collapsed-row summary takes its most severe member's colour (G-BOARD-8). Contrast check of the current kit tokens (WCAG 2 ratio, computed here): on `--bg` #e9eef2, `--accent` #d05f1a is 3.37:1 and `--warn` #a2640b is 4.12:1. Both fail 4.5:1 for small text, though they pass 3:1 for icons and graphics. On `--surface` #f8fafb, warn passes (4.60) and accent still fails (3.76). `--ok` is 4.53 on bg, just enough. `--border` #a9b8c5 is 1.74:1. That is fine for decoration but can't be the only boundary of a control (WCAG-1411). Use `--border-strong` (3.31) there.
5. **Density and type.** The kit's 15px body and 4px spacing unit sit between Atlassian's 14px component default and 16px long-form size (G-DENSE-2/3). Card rows around 32–40px match Carbon's sm/md (G-DENSE-1). Get hierarchy by dimming the chrome and cutting separators, as Linear does (G-DENSE-4), and reserve the orange accent for the one thing that needs attention.
6. **State copy templates.**
   - Loading: nothing for under about 300 ms, then a skeleton of the board rows, then "Loading tickets…" with `aria-busy` (G-LOAD-1–4).
   - Empty board: "No open tickets in owner/repo yet", plus one action such as "Create an idea" (G-EMPTY-2). Empty status row: collapse it, or show a single muted line "None" (G-EMPTY-4).
   - Error: say the cause and the fix. For example "Can't reach GitHub: `gh` isn't logged in. Run `gh auth login`, then Retry." or "GitHub rate limit hit; resuming at 14:05." No "sorry" or "please", no codes unless they help diagnosis (G-ERR-1/2).
   - Stale: "Updated 2 min ago" next to the board (absolute time in `title`). When polling fails, keep the cards, add a warning banner with the last good time and the fix, and hide counts that can't be trusted (G-STALE-1, G-ERR-3). Announce refreshes with `role="status"` (G-STALE-2).
