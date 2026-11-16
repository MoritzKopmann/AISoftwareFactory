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
platforms: [linux]
```

## Running the commands (RC)

- **RC1 Must:** use Node ≥22 (`.nvmrc` says 22). On an older Node, `npm ci` warns `EBADENGINE` and the tools fail. Switch Node rather than work around it.
- **RC2 Must:** run every command from the repo root after `npm ci`. `{file}` is a path relative to the root, e.g. `packages/app/src/shared/http.test.ts`.
- **RC3 Must:** know that `format` rewrites files. CI runs the check-only variant, `npm run format:check`.

Prettier ignores `.claude/`, `.aisf/` and `package-lock.json`.

## Reading analyze output (RA)

`analyze` runs three stages in order and stops at the first failure:

| Stage | Runs | An error looks like |
|---|---|---|
| `typecheck` | `tsc` per workspace (`app`, `ui`) | `file(line,col): error TSxxxx` |
| `lint` | ESLint with `typescript-eslint` strict | Grouped by file, rule name last on each line |
| `depcruise` | dependency-cruiser over `packages/` | Names the rule (e.g. `no-circular`, or a module-boundary rule) and the `from → to` import that broke it. A boundary violation is an architecture breach under `project-architecture`, not a lint nit |

- **RA1 Must:** treat every error and warning as a failure. Fix the cause. Add no `eslint-disable`, `@ts-ignore` or depcruise exception without saying why in the PR.

## Adding a dependency (AD)

- **AD1 Must:** ask the human before adding a dependency. It is never the agent's call.
- **AD2 Must:** pick a candidate that is actively maintained (a release in the last 12 months) and widely used on npm.
- **AD3 Must:** pick a permissive licence (MIT, ISC, BSD, Apache-2.0).
- **AD4 Must:** pick one that ships ESM and its own TypeScript types (or has maintained `@types/…`).
- **AD5 Must:** pick pure JS: no native addons or install scripts. It must run on Node ≥22 on every platform in `platforms`.
- **AD6 Should:** pick a small one, not already covered by the Node standard library or an existing dependency.
- **AD7 Must:** add it to the workspace that uses it (`npm install <pkg> -w @aisf/app`), not the root. The root holds only dev tooling.
