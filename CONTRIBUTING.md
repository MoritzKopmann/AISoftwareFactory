# Contributing

## Load the aisf plugin in hand-run sessions

AISoftwareFactory builds itself with its own `aisf` plugin (`packages/plugin`). The package is also a local-directory marketplace named `aisf`. Run these two commands once per checkout, from the root of the main checkout (not a worktree):

```sh
claude plugin marketplace add "$PWD/packages/plugin"
claude plugin install aisf@aisf --scope local
```

- The first command registers the marketplace in your user settings. It points at this checkout, so run it from the checkout you keep.
- The second command enables the plugin in the gitignored `.claude/settings.local.json` only, so nothing is committed. It covers worktrees of this checkout too.

Each time `aisf` starts it mirrors `packages/plugin` into `~/.aisf/plugins/aisf/` and re-points the `aisf` marketplace there. Until the app has run once, the marketplace still points at this checkout. Check it with `/aisf:implement-ticket` in a fresh session.
