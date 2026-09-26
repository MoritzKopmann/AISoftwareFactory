---
name: project-toolchain
description: >
  AISoftwareFactory toolchain: the format, analyze and test commands, dependency manifests,
  registry and target platforms. Use when running checks or tests, or when evaluating a new
  dependency.
user-invocable: false
---

```yaml aisf-toolchain
format: npm run format
analyze: npm run analyze
test: npm test
test_file: npm run test:file -- {file}
manifests: [package.json, package-lock.json, packages/app/package.json, packages/ui/package.json, packages/plugin/package.json]
registry: npmjs.com
platforms: [linux, macos]
```

## Running the commands

- **Node ≥22 is required** (`.nvmrc` says 22). On an older Node, `npm ci` warns `EBADENGINE` and the tools fail. Switch Node rather than work around it.
- Run every command from the repo root after `npm ci`. `{file}` is a path relative to the root, e.g. `packages/app/test/placeholder.test.ts`.
- `format` rewrites files. CI runs the check-only variant, `npm run format:check`. Prettier ignores `.claude/`, `.aisf/` and `package-lock.json`.

## Reading `analyze` output

`analyze` runs three steps in order and stops at the first failure:

1. **`typecheck`**: `tsc` per workspace (`app`, `ui`). Errors are `file(line,col): error TSxxxx`.
2. **`lint`**: ESLint with `typescript-eslint` strict. Errors are grouped by file, with the rule name last on each line.
3. **`depcruise`**: dependency-cruiser over `packages/`. A violation names the rule (e.g. `no-circular`, or a module-boundary rule) and the `from → to` import that broke it. A boundary violation is an architecture breach under `project-architecture`, not a lint nit.

Treat every error and warning as a failure. Fix the cause. Never add an `eslint-disable`, `@ts-ignore` or a depcruise exception without saying why in the PR.

## Adding a dependency

A new dependency is never the agent's call: it becomes a question for the human. The bar a candidate must clear:

- Actively maintained (a release in the last 12 months) and widely used on npm.
- A permissive licence (MIT, ISC, BSD, Apache-2.0).
- Ships ESM and its own TypeScript types (or has maintained `@types/…`).
- Pure JS: no native addons or install scripts. It must run on Node ≥22 on every platform in `platforms`.
- Small, and not already covered by the Node standard library or an existing dependency.

Add it to the workspace that uses it (`npm install <pkg> -w @aisf/app`), not the root. The root holds only dev tooling.
