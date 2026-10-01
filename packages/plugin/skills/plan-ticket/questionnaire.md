# The questionnaire page

Every interview round and the Confirm gate live on **one published page per planning session**.
Chat gets the link only. Load `artifact-design` and `artifact-capabilities`, and
`artifact-diagramming` where you draw. Declare `capabilities: {artifact: {}}`. Design freely:
only this contract is fixed.

**One card per question, short.** Title, one or two sentences, then the answer choices: the
suggestion (marked, one line of why) · the other legal options · free text · **Discuss** with an
optional note.

**Show what the decision is about, wherever that beats words**: the real code by path, a state
diagram, a flow chart, a before and after, a mockup. No walls of text. Too little to decide on →
the human says so in Discuss, and the question returns next round with more.

**Submit** unlocks once every card is answered. **Accept all remaining** fills the open cards
with the suggestion. Submit saves the answers as data in the page, through `artifact.publish`.
**Copy answers** exports `Q<n> · <title> · <answer> · note: …` as a fallback.

**Read the answers** from the republish notice if the publish result confirmed a watch, else
`read` the page, or take the pasted export. Answer Discuss notes briefly in chat.

**The next round** goes on the same page, in focus. Earlier rounds freeze into read-only
summaries: decision · answer · `assumes:`. Reopening one goes through chat or a note.

**Confirm** is the last section, after the final round: the step 5 table, a diagram only where
it shows the split better than the table, and **Confirm** and **Reopen** (with a note), which
save like Submit.

The page is a decision device: disposable, and never linked from GitHub.
