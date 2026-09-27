# TypeScript structure extraction at a git ref

Research for [#58](https://github.com/MoritzKopmann/AISoftwareFactory/issues/58) (part of map [#57](https://github.com/MoritzKopmann/AISoftwareFactory/issues/57)).
It feeds [#61](https://github.com/MoritzKopmann/AISoftwareFactory/issues/61) and [#62](https://github.com/MoritzKopmann/AISoftwareFactory/issues/62).
Researched 2026-09-27 with Node 22.23.3, dependency-cruiser 18.4.0, TypeScript 6.0.3 and ts-morph 28.0.0 (which bundles TypeScript 6.0.2).
Claims marked **verified** were run on this repo (57 `.ts`/`.tsx` files, about 1,900 lines, at `1bd5a13`) or on a small fixture built to exercise each import kind. The scripts are reproduced in the appendix.

## Answer

**Use dependency-cruiser's JavaScript API (`cruise()`) as the TypeScript adapter. Check each ref out into a throwaway detached `git worktree` with hooks disabled, and remove it afterwards. Don't use ts-morph. Keep the raw compiler API as a fallback, not the first choice.**

- **What it sees:** it sees everything the Level 1 view needs. Static imports, re-exports, `import type` and inline `{ type X }` imports, `typeof import()` types, `tsconfig` `paths` aliases and literal dynamic `import()` all show up as file → file edges. Each edge carries a `dependencyTypes` label such as `type-only`, `export`, `dynamic-import` or `aliased-tsconfig-paths` (**verified**). The one blind spot is a computed dynamic import (`` import(`./${name}.js`) ``). dependency-cruiser drops it silently. The raw compiler API can at least report that it exists.
- **Output:** it gives a JSON `{ modules[], summary }`. Every `modules[].dependencies[]` entry has its resolved path, its labels and a rule verdict. Two runs gave byte-identical output (**verified**). The only machine-specific fields are the absolute `summary.optionsUsed.baseDir` and `summary.environment`, so strip or ignore those.
- **Bonus:** it evaluates the project's own `forbidden` rules on the same pass, so violations come free with the graph. AISF's `.dependency-cruiser.cjs` already encodes its module and layer rules.
- **Speed at AISF size:** about 0.6 s wall clock per ref from the CLI, including Node startup. The raw compiler API needs about 0.37 s when it only parses, and ts-morph needs about 1.2 s. All three found the same 71 local file → file edges (**verified**). A PR (two refs) costs well under 2 s, and the checkout itself costs about 30 ms.
- **Checking out a ref:** `git -c core.hooksPath=/dev/null worktree add --detach <tmp> <ref>` took 0.03 s here (**verified**). It never touches the user's working tree or index. `git archive` works as well and leaves no trace at all. Reading blobs with `git show` would only work with a custom compiler host, and dependency-cruiser can't use one because it reads files through `node:fs`.
- **Main catch:** the temporary checkout has no `node_modules`. npm packages then show up as unresolved names, which doesn't matter for local structure. The exception is imports between npm-workspace packages (`@scope/pkg` → `packages/pkg`), which would lose their edges. AISF has none today. Other projects will need an alias built from the `workspaces` globs.
- **Version risk:** TypeScript 7.0 (July 2026) ships no compiler API. dependency-cruiser supports `typescript >=2 <7`, so AISF must pin its own TypeScript 6.x as the parser. It must not rely on the analysed project's copy.

## 1. The three options compared

| | dependency-cruiser 18.4 | ts-morph 28 | Raw TypeScript compiler API (6.0) |
|---|---|---|---|
| **How it extracts** | Parses each file with `typescript.createSourceFile` (parse only, no Program), then resolves with webpack's `enhanced-resolve`, configured from tsconfig (`paths`) and `package.json` (`exports`, `workspaces`, `imports`). Source: `src/extract/tsc/parse.mjs` | A wrapper over a full `ts.Program`. `ImportDeclaration.getModuleSpecifierSourceFile()` resolves through the program | Whatever you write. It's fastest with `ts.createSourceFile` plus `ts.resolveModuleName` and a shared `ModuleResolutionCache`, without a Program |
| **Static import / re-export** | yes, labelled `import` or `export` | yes, via `getImportDeclarations()` and `getExportDeclarations()` | yes, via an AST walk |
| **`import type`, `export type … from`** | yes, labelled `type-only`, if `tsPreCompilationDeps` is `true` or `"specify"`. With the default `false` they are **dropped**, because they don't survive compilation to JS ([options reference](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md#tspre-compilation-deps)) | yes, via `isTypeOnly()`. You classify it yourself | yes, via `importClause.isTypeOnly`. You classify it yourself |
| **Inline `import { type X }` (all specifiers type-only)** | labelled `type-only` (**verified**) | only if you check every specifier yourself | only if you check every specifier yourself |
| **`typeof import('./a.js')`** | labelled `type-import` (**verified**) | you walk the `ImportType` nodes yourself | you walk the `ImportType` nodes yourself |
| **tsconfig `paths` alias** | resolved and labelled `aliased-tsconfig-paths` (**verified**) | resolved by the TS program | resolved by `resolveModuleName` (**verified**) |
| **Literal dynamic `import('./x.js')`** | labelled `dynamic-import`, with `dynamic: true` (**verified**) | through the type checker | via an AST walk and `resolveModuleName` |
| **Computed dynamic `` import(`./${n}.js`) ``** | **silently dropped** (**verified**) | you can detect it, but not resolve it | you can detect it, but not resolve it |
| **Node built-ins** | labelled `core`. `node:fs` is normalised to `fs` | reported unresolved (no `@types/node` in the fixture) | reported unresolved unless `types` is loaded |
| **npm-workspace imports** | labelled `aliased-workspace`, but only when `node_modules` symlinks exist (`src/extract/resolve/module-classifiers.mjs`) | needs `node_modules` or `paths` | needs `node_modules` or `paths` |
| **Rules and violations** | yes: the `forbidden` rules plus circular, orphan and reachability checks, in the same run | no | no |
| **Output** | JSON, stable across runs (**verified**) | none, you build it | none, you build it |
| **Time on AISF (wall clock)** | ~0.6 s (CLI, incl. startup) | ~1.2 s (0.85 s after load) | ~0.37 s parse-only (80–120 ms after load). Building a full Program costs 0.53 s after load |
| **Code AISF must write** | a thin mapper from JSON to the snapshot model | the full extractor | the full extractor, including resolution and labels |

The local edges agree. After de-duplicating repeated imports of the same file, the raw compiler API extractor found 71 unique local file → file edges on AISF, the same 71 that dependency-cruiser reported (**verified**). The totals differ only because this repo's config `exclude`s `node_modules`, which removes npm-package edges.

### Why not ts-morph

ts-morph adds nothing that the Level 1 view needs. It is the slowest option because it builds a Program with a type checker, and it bundles its own TypeScript (6.0.2 in 28.0.0). Its strength is navigating and changing code at the symbol level, which could matter later for Level 2 and 3 (classes and methods). Revisit it then.

### Why not the raw compiler API first

It is fastest, and it's the only option that can read from a virtual file system. For example, a `CompilerHost` whose `readFile` and `fileExists` are backed by `git cat-file --batch` would need no checkout at all. But AISF would have to reimplement the things dependency-cruiser already does and tests: module resolution across `exports`, `imports`, `paths` and workspaces, edge classification, and the rule engine. The checkout costs about 30 ms, so skipping it saves nothing that matters.

## 2. Output shape (dependency-cruiser `--output-type json`)

Run on this repo (**verified**): the top-level keys are `modules` and `summary`. `summary` has `violations`, `error`, `warn`, `info`, `ignore`, `totalCruised`, `totalDependenciesCruised`, `optionsUsed`, `ruleSetUsed` and `environment`. One dependency entry:

```json
{
  "source": "packages/app/src/main.ts",
  "dependencies": [{
    "module": "./cli/is-on-path.js",
    "resolved": "packages/app/src/cli/is-on-path.ts",
    "moduleSystem": "es6",
    "dependencyTypes": ["local", "import"],
    "dynamic": false,
    "couldNotResolve": false,
    "circular": false,
    "valid": true
  }],
  "dependents": [],
  "orphan": false,
  "valid": true
}
```

- `source` and `resolved` are relative to `baseDir`, which defaults to the cwd ([options reference, `baseDir`](https://github.com/sverweij/dependency-cruiser/blob/main/doc/options-reference.md)). Paths are therefore comparable across two checkouts of different refs. **Verified:** a base/head diff of the local edge sets (`530308e` vs `1bd5a13`) produced 46 added and 0 removed edges, with no path rewriting.
- The full list of `dependencyTypes` is the `DependencyType` union in `types/shared-types.d.mts`. The useful ones here are `local`, `import`, `export`, `type-only`, `type-import`, `dynamic-import`, `aliased-*`, `core`, `npm*` and `pre-compilation-only`.
- `tsPreCompilationDeps: "specify"` additionally marks edges that exist only before compilation (`pre-compilation-only`). With `true`, type-only edges are included and labelled `type-only` (**verified**, and that's what AISF's config uses).

## 3. Analysing a ref without disturbing the checkout

| Method | Cost on AISF | Side effects | Caveats |
|---|---|---|---|
| **`git worktree add --detach <tmp> <ref>`** | 0.03 s (**verified**) | Adds an admin entry under `.git/worktrees/`, visible in `git worktree list` until `git worktree remove --force` and `git worktree prune`. The user's working tree, index and HEAD are untouched | Runs the **post-checkout hook** unless `--no-checkout` is used ([githooks](https://git-scm.com/docs/githooks#_post_checkout)). Disable hooks with `-c core.hooksPath=/dev/null` (**verified**). Checkout filters such as LFS smudge still run. `--detach` avoids the "branch already checked out" refusal |
| **`git archive <ref> \| tar -x -C <tmp>`** | 0.014 s to write the tar (**verified**) | none in the repo | Files marked `export-ignore` in `.gitattributes` are left out, and `export-subst` rewrites files ([gitattributes, "Creating an archive"](https://git-scm.com/docs/gitattributes#_creating_an_archive)). That's rare for source files, but it silently drops them when it happens |
| **Blobs via `git show` / `git cat-file --batch`** | `ls-tree -r` 0.004 s (**verified**) | none | Only works with an in-memory host, which means the raw compiler API. dependency-cruiser reads sources with `readFileSync` (`src/extract/tsc/parse.mjs`) and resolves against the real file system, so it can't use this |

Neither checkout has `node_modules`, and that's fine for Level 1. **Verified:** running AISF's installed dependency-cruiser in a `node_modules`-less worktree of `530308e` succeeded. `hono`, `vitest`, `vite` and the other packages came back as `couldNotResolve` nodes, and every local edge resolved. Two consequences:

1. **Rules:** any `not-to-unresolvable` rule fires on npm packages (25 false violations here). Either filter it out or cruise with an AISF-owned options object instead of the project's config file.
2. **Workspaces:** cross-workspace imports need the `node_modules/@scope/*` symlinks. Don't symlink the user's `node_modules` into the temporary checkout. Its workspace links are relative (`../../packages/app`), so they would resolve into the *user's* checkout at the wrong ref. Instead, generate `enhancedResolveOptions.alias` from the root `package.json` `workspaces` globs and each package's `name`.

`git diff --name-status <base> <head>` gives the changed files without any checkout, which is enough to highlight changed nodes.

## 4. Running it inside AISF

- **Dependency:** `dependency-cruiser` (MIT) and `typescript` would move from devDependencies to runtime dependencies of `@aisf/app`. `dependency-cruiser` 18.4.0 requires `node ^22||^24||>=26` (`npm view`). It is ESM-only (`exports["."].import`), which suits AISF.
- **API:** `cruise(fileAndDirectoryArray, cruiseOptions?, resolveOptions?, transpileOptions?) => Promise<IReporterOutput>` (`types/dependency-cruiser.d.mts`). Pass `baseDir` set to the temporary checkout and an AISF-owned options object: `tsPreCompilationDeps: true`, `tsConfig`, `enhancedResolveOptions`, `exclude` and `doNotFollow`. Then no project-supplied `.cjs` is ever `require`d. Loading the project's config would run its code.
- **Process isolation:** dependency-cruiser keeps a module-level AST cache keyed by absolute file name (`src/extract/tsc/parse.mjs`) and initialises its resolver once per session unless `bustTheCache` is set (`types/resolve-options.d.mts`). A long-running server would pile up ASTs from every temporary checkout. Run each extraction in a short-lived child process (`node … --output-type json` or a small worker). That also contains crashes.
- **TypeScript 7:** 7.0 went GA on 2026-07-08 and "does not ship with an API". A new, different API is expected in 7.1, and 6.0 remains available as `@typescript/typescript6` ([Announcing TypeScript 7.0](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/)). **Verified:** `typescript@7.0.2`'s `exports["."]` is only `./lib/version.cjs`, and the API lives under `./unstable/*`. dependency-cruiser's supported range is `typescript >=2.0.0 <7.0.0` (`src/meta.cjs`). So AISF must bundle a pinned TypeScript 6.x for parsing, whatever version the analysed project uses. Parse-only extraction doesn't care about the project's compiler version, as long as the syntax stays within 6.0 (7.0 is a faithful port).

## Open questions (possible tickets)

- **Workspace aliasing:** how the TS adapter derives aliases for npm/pnpm/yarn workspaces, and TS project references, when `node_modules` is absent. It doesn't matter for AISF today but will for other TS monorepos.
- **Whose rules:** should the view evaluate the analysed project's own `.dependency-cruiser.cjs`? That means running project code, and it gives false unresolvable violations without `node_modules`. The alternative is AISF's declared per-project rule set only (the map's "per-project declared rule set").
- **Snapshot caching:** a snapshot is a pure function of (tree SHA, AISF analyzer version, options), so it could be cached per commit. It is cheap to recompute at AISF size, so maybe that isn't needed.
- **Computed dynamic imports:** should the model carry an "unknown dynamic dependency" marker? dependency-cruiser can't provide one, so that would need a small extra AST pass.

## Appendix: how it was verified

All runs used Node 22.23.3 from the nodejs.org tarball (system Node is 18).

- `npx depcruise packages --output-type json`, run twice, compared with `cmp`: identical.
- Fixture `src/feat/use.ts` covering `import type`, `import { type B } from '@lib/b.js'` (a `paths` alias), a barrel `export * from` plus `export type { B } from`, `import * as fs from 'node:fs'`, `await import('../lib/lazy.js')`, `` await import(`../lib/${name}.js`) `` and `typeof import('../lib/a.js')`. dependency-cruiser edges:

  ```
  src/feat/typeof-only.ts -> src/lib/a.ts  [local,type-import]
  src/feat/use.ts -> src/lib/a.ts          [local,type-only,import]
  src/feat/use.ts -> src/lib/index.ts      [local,import]
  src/feat/use.ts -> src/lib/lazy.ts       [local,dynamic-import] dynamic=true
  src/feat/use.ts -> src/lib/b.ts          [aliased,aliased-tsconfig,aliased-tsconfig-paths,local,type-only,import]
  src/feat/use.ts -> fs                    [core,import]
  src/lib/index.ts -> src/lib/a.ts         [local,export]
  src/lib/index.ts -> src/lib/b.ts         [local,type-only,export]
  ```

  (The computed template-literal import is missing.) Re-exports produce an edge to the barrel only. dependency-cruiser does not follow `export *` through to the file that defines the symbol, and neither do the other two options without a type checker.
- Compiler-API extractor: `readConfigFile` → `parseJsonConfigFileContent` → `createSourceFile` per file → AST walk over `ImportDeclaration`, `ExportDeclaration`, `import()` calls and `ImportTypeNode` → `resolveModuleName` with `createModuleResolutionCache` and `getModeForUsageLocation`. ts-morph extractor: `new Project({ tsConfigFilePath })` → `getImportDeclarations()` / `getExportDeclarations()` → `getModuleSpecifierSourceFile()`.
- Ref analysis: `git -c core.hooksPath=/dev/null worktree add --detach /tmp/…/wt-base 530308e` (0.031 s), then the depcruise CLI from AISF's install with cwd set to the worktree (0.79 s wall clock), then `git worktree remove --force`.
