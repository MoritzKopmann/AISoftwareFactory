# Shape: project-testing

Structure only. Fill from the sources.

- `## Mechanics`: runner, how to run a file and the suite, what is tested where, and the table
  of changes that can't be unit-tested (columns: Change, Proof instead). Anything not in the
  table gets a failing test first.
- `## Layout and naming`: where a test sits, file naming, test naming, test body shape.
- `## Fakes and fixtures`: how fakes, fixtures and data builders are written and where they live.
- `## Visual rendering`: optional. Only when the owner answered frontend `yes`; otherwise leave
  it out. The project's recipe for rendering one component to PNG. Four parts:
  - **Render target:** how one component is shown alone, per state.
  - **Command:** what to start, then the exact command that writes a PNG at a given width.
  - **Themes:** how to get light and dark.
  - **Gotchas:** fonts, icons, anything that makes a render differ from the app.
- `## Load also`: project-only skills plugin skills must load when testing. `None yet.` if none.
