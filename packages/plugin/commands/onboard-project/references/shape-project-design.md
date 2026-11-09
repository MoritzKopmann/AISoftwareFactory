# Shape: project-design

Free-form. Structure is the owner's call: simple to complex. This slot is optional. Its presence
marks the project as having a frontend. `aisf:design` reads it to draw in the project's own look.

Suggest these sections. Each is a suggestion until the owner confirms it:

- **Tokens:** where design tokens live (file path) and the command that dumps them.
- **Fonts:** where font files live locally, so a design needs no network.
- **Icons:** where icon files live locally.
- **Anything else the owner wants `aisf:design` to know:** components, layout rules, tone.

Fill from the sources: look for token files (CSS custom properties, theme files, Tailwind or
design-token config), font and icon folders, and any style guide.
