# Prior art: architecture models and structural diffs

Research for [#59](https://github.com/MoritzKopmann/AISoftwareFactory/issues/59) (map [#57](https://github.com/MoritzKopmann/AISoftwareFactory/issues/57)). Researched 2026-09-27.

**Question.** What do existing models of architecture and their diffs look like? The goal is an AISF snapshot model that starts at Level 1 (modules × layers, plus an event channel) and grows to Level 0 (system context), Level 2 (class) and Level 3 (method). It must stay language-neutral and support a structural diff between two refs. This note covers entity kinds, stable identifiers across levels and refs, edge typing, and diff representation.

**Short answer.** No surveyed tool has all of: one hierarchical, language-neutral entity tree; typed edges recorded at the finest level and rolled up to coarser levels; and a diff that marks nodes *and* edges between two refs. Each piece exists somewhere:

- The **hierarchy plus path-style IDs** come from Structurizr and LikeC4.
- **Edge kinds that carry meaning** come from Spring Modulith, dependency-cruiser and ReviewVis.
- **Roll-up of fine edges to coarse levels** comes from Structurizr's implied relationships, LikeC4's merged relationships and dependency-cruiser's collapse.
- **Per-node and per-edge change status** comes from ReviewVis and CodeSee.

AISF should combine these. See [Recommendation](#recommendation-for-aisf).

---

## 1. Spring Modulith: `ApplicationModules` and `Documenter`

**Entity kinds.**
- An *application module* has a logical name and a base package. By default, every direct sub-package of the main application package is a module ([fundamentals](https://docs.spring.io/spring-modulith/reference/fundamentals.html)).
- A module has a *provided interface* (Spring beans and published events), an *internal implementation*, and a *required interface* (bean dependencies, events it listens to, configuration properties it exposes) ([fundamentals](https://docs.spring.io/spring-modulith/reference/fundamentals.html)).
- *Named interfaces* (`@NamedInterface("spi")`) expose extra packages. Rules refer to them as `module :: interface`, e.g. `allowedDependencies = "order :: spi"`.
- Modules can be closed (the default) or `Type.OPEN`. Since 1.3 they can also be *nested* ([fundamentals](https://docs.spring.io/spring-modulith/reference/fundamentals.html)).

**Identifiers.**
- `ApplicationModuleIdentifier` is a plain comparable string. The only rule is that it must not contain `::`, because `::` separates a module from a named interface ([source](https://github.com/spring-projects/spring-modulith/blob/main/spring-modulith-core/src/main/java/org/springframework/modulith/core/ApplicationModuleIdentifier.java)).
- The ID comes from the package, so it stays stable across commits unless the package is renamed.

**Edge typing.**
- `ApplicationModuleDependency` records `getSourceType()`, `getTargetType()` (ArchUnit `JavaClass`), `getDependencyType()` and `getTargetModule()` ([source](https://github.com/spring-projects/spring-modulith/blob/main/spring-modulith-core/src/main/java/org/springframework/modulith/core/ApplicationModuleDependency.java)).
- So each module-level edge keeps the class-level pair that caused it. That is exactly the link from Level 1 down to Level 2.
- `DependencyType` has four values ([source](https://github.com/spring-projects/spring-modulith/blob/main/spring-modulith-core/src/main/java/org/springframework/modulith/core/DependencyType.java)):
  - `USES_COMPONENT`: "the other module needs to be bootstrapped to run the source module".
  - `ENTITY`: "the module refers to an entity of the other".
  - `EVENT_LISTENER`: the module listens to an event of the other, so "the target module does not have to be bootstrapped".
  - `DEFAULT`: any other reference.
- Events are a separate edge kind, not an ordinary call. This is the model behind the Strukturblatt's event channel under the Level 1 grid.

**Documentation output.**
- `Documenter` builds an in-memory **Structurizr** `Workspace`. The application becomes one `SoftwareSystem` with one `Container`, and each module becomes a `Component` tagged `"Module"` ([Documenter.java](https://github.com/spring-projects/spring-modulith/blob/main/spring-modulith-docs/src/main/java/org/springframework/modulith/docs/Documenter.java), lines ~137–149 and ~483).
- Dependencies become Structurizr `Relationship`s tagged with the `DependencyType` name and described as "uses", "listens to" or "depends on" (lines ~90–91 and ~465–473).
- Output is C4 or UML PlantUML diagrams, plus per-module **Application Module Canvases**. A canvas is a table of the base package, the Spring components grouped by stereotype, aggregate roots, published events, events listened to, and configuration properties ([documentation](https://docs.spring.io/spring-modulith/reference/documentation.html)).
- `DiagramOptions.withDependencyTypes(...)` filters edges by kind.

**Diffs.** None. Modulith verifies one snapshot against its rules. It does not compare two refs.

**Takeaway for AISF.** Level 1 is a module × dependency-kind graph in which every module edge keeps its underlying type-level edges. Events are first-class. The canvas is a good template for a module's detail panel.

## 2. C4 model and Structurizr (DSL and JSON workspace)

**Entity kinds.**
- C4 defines people and software systems. Systems contain containers, containers contain components, and components are "implemented by one or more code elements (classes, interfaces, objects, functions, etc)" ([abstractions](https://c4model.com/abstractions)).
- C4 advises *against* hand-made code diagrams (Level 4): "No, particularly for long-lived documentation because most IDEs can generate this level of detail on demand" ([code diagram](https://c4model.com/diagrams/code)). Structurizr follows this. Its current `Component` has no code-element children ([Component.java](https://github.com/structurizr/structurizr/blob/main/structurizr-core/src/main/java/com/structurizr/model/Component.java)).
- The DSL adds deployment nodes, infrastructure nodes, groups, tags, `properties` and `perspectives` ([DSL language](https://docs.structurizr.com/dsl/language)).

**Identifiers.** Structurizr has three kinds of identity, and they matter for AISF:

1. **Workspace `id`s** default to *sequential integers*, from `SequentialIntegerIdGeneratorStrategy` ("This is the default ID generator"). They depend on creation order, so they are **not stable across versions** ([source](https://github.com/structurizr/java/blob/master/structurizr-core/src/main/java/com/structurizr/model/SequentialIntegerIdGeneratorStrategy.java)). Note: the structurizr/java and related repos are now archived and consolidated into [structurizr/structurizr](https://github.com/structurizr/structurizr), and the separate `structurizr/json` schema repo is gone.
2. **Canonical names** are type-prefixed paths such as `Component://System.Container.Component` and `Relationship://<src> -> <dst> (<description>)`. Dots and slashes are stripped from names ([CanonicalNameGenerator.java](https://github.com/structurizr/java/blob/master/structurizr-core/src/main/java/com/structurizr/model/CanonicalNameGenerator.java)).
3. **DSL identifiers** are flat or hierarchical (`!identifiers hierarchical` gives `system.container.component`) ([DSL language](https://docs.structurizr.com/dsl/language)). The JSON records them as the property `structurizr.dsl.identifier` ([sample workspace](https://github.com/structurizr/structurizr/blob/main/structurizr-application/src/test/merge/workspace.json)).

The most relevant precedent for AISF is **`DefaultLayoutMergeStrategy`**. It carries diagram positions from one workspace version to the next, so it has to match elements across versions without stable IDs ([source](https://github.com/structurizr/structurizr/blob/main/structurizr-core/src/main/java/com/structurizr/view/DefaultLayoutMergeStrategy.java)):

- It matches elements by *full canonical name*, then by *name + type* ("the parent element may have been renamed"), then by *description + type* ("the element itself may have been renamed"), and finally by ID.
- It matches relationships by (mapped source, mapped destination, description), and then by ID.

This is how Structurizr handles identity across versions: a path-based key first, with fallbacks for renames.

**Edge typing.**
- A `Relationship` has `sourceId`, `destinationId`, a free-text `description` and `technology`, `interactionStyle` (`Synchronous` or `Asynchronous`), tags, properties, and `linkedRelationshipId` ([Relationship.java](https://github.com/structurizr/java/blob/master/structurizr-core/src/main/java/com/structurizr/model/Relationship.java)).
- There is no closed set of edge kinds. Meaning comes from tags and description text.

**Roll-up across levels.**
- *Implied relationships* create parent-level edges from child-level edges. If a person uses a container, the person → software system edge is implied.
- The default strategy is `CreateImpliedRelationshipsUnlessAnyRelationshipExistsStrategy`, and it can be switched with `!impliedRelationships` ([implied relationships](https://docs.structurizr.com/dsl/implied-relationships)).
- `linkedRelationshipId` points from an implied edge back to the edge it came from.

**Diffs.** None in the model. Workspaces are versioned whole, and only layout is merged.

**Takeaway for AISF.**
- Use path-based canonical IDs, not generated ones.
- Record edges at the finest level and derive parent edges, with a back-link to their source edges.
- The layout-merge fallback chain is a ready-made design for detecting renames/moves in a structural diff.

## 3. LikeC4

**Entity kinds.**
- The `specification` block lets you define custom element kinds, e.g. `element queue { … }`, and custom relationship kinds, e.g. `relationship async { … }`. Kinds carry default title, technology and style ([specification](https://likec4.dev/dsl/specification/)).
- So LikeC4 is C4-shaped but not tied to C4's fixed four kinds.

**Identifiers.**
- Elements nest, and the **fully qualified name** is the dotted path (`service1.backend.api`).
- Names cannot contain `.` and must be unique within their parent ([model](https://likec4.dev/dsl/model/)).
- The FQN serves as both the identity and the zoom path.

**Edge typing.**
- Kinded relationships use the syntax `a -[async]-> b` or `a .uses b`. They also have title, description, technology, tags and links ([relationships](https://likec4.dev/dsl/relationships/)).

**Roll-up across levels.**
- In views, "connections represent merged relationships - direct between elements and/or those derived from their nested elements".
- `.*` includes children and `.**` includes descendants that have relationships with visible elements ([predicates](https://likec4.dev/dsl/views/predicates/)).
- A scoped view (`view of cloud.backend`) is a zoom into one element ([views](https://likec4.dev/dsl/views/)).

**Diffs.** None.

**Takeaway for AISF.**
- Use an *open, declared vocabulary* of element and edge kinds. Per-language adapters and the per-project rule set can declare kinds such as `layer`, `event`, `route` or `table`.
- Use dotted-path FQNs.
- Compute view-level edges by merging descendant edges onto the visible ancestors.

## 4. dependency-cruiser (`archi`, `ddot`, JSON)

**Entity kinds.**
- The unit is a *module* (a file), identified by its resolved path `source`, e.g. `src/main/index.js` ([cruise-result schema](https://github.com/sverweij/dependency-cruiser/blob/main/src/schema/cruise-result.schema.json)).
- `ModuleType` carries `dependencies`, `dependents`, `orphan`, `reachable`/`reaches`, `rules`, `instability`, an optional content `checksum`, and `consolidated`. A consolidated module stands for "several modules at the same time" after roll-up.

**Edge typing.** This is the richest mechanical edge typing surveyed.
- Each dependency carries a `dependencyTypes` *array*, drawn from 40 values such as `local`, `npm`, `core`, `import`, `require`, `export`, `dynamic-import`, `type-only`, `type-import`, `aliased-tsconfig-paths` and `triple-slash-directive`.
- It also carries flags: `circular`, `dynamic`, `typeOnly`, `preCompilationOnly`, `valid`, and rule violations ([schema](https://github.com/sverweij/dependency-cruiser/blob/main/src/schema/cruise-result.schema.json)).
- For TypeScript, "type-only" versus runtime import is the most important distinction.

**Roll-up across levels.**
- `ddot` "summarises modules on folder level".
- `archi` "can summarise (or 'collapse') dependencies to folders of your own choosing". By default it collapses one folder below `node_modules`, `packages`, `src`, `lib` and `test`.
- `--collapse` takes a depth or a regex, e.g. `^packages/[^/]+`, and works for every reporter ([CLI docs](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md#archi-cdot)).
- Modules are grouped by *path pattern*, which is how a TypeScript adapter can map files to AISF modules and layers.

**Diffs.**
- `--affected <rev>` means "only include modules changed since the revision + all modules that can reach them". It is sugar for `--reaches "$(watskeburt main)"` and pairs with `--highlight` or mermaid output in PR comments ([CLI docs](https://github.com/sverweij/dependency-cruiser/blob/main/doc/cli.md#--affected-show-modules-and-their-transitive-dependents-since-a-git-revision)).
- Git change data uses the enum `added`, `copied`, `deleted`, `modified`, `renamed` (with `oldName`), `type changed`, and others (`RevisionDataType` in the schema).
- This is **file-change highlighting on a single snapshot**, not a diff of two graphs. An edge that was *removed* cannot be shown.

**Takeaway for AISF.**
- Borrow the edge-kind *array* (one edge can be both `import` and `type-only`) and the path-regex collapse.
- dependency-cruiser is a strong candidate for the extraction layer of the TypeScript adapter. That is a question for a later ticket.
- Its diff model is too weak to copy.

## 5. Diff prior art

### CodeSee Review Maps

- The PR bot posts a file/folder graph ([Review Map guide](https://docs.codesee.io/docs/user-guide)):
  - Green boxes are added files, orange boxes are modified, red boxes are removed.
  - White boxes are "files that are unchanged, but have a changed file as a dependency" (impact context).
  - Green lines are dependencies added in the PR, and red lines are dependencies removed.
- Folders expand and collapse, and nodes can be marked "Reviewed" ([review guide](https://docs.codesee.io/docs/review-map-guide)).
- Granularity is file/folder only.
- GitKraken acquired CodeSee in May 2024 ([press release](https://www.gitkraken.com/press/gitkraken-acquires-codesee-launches-devex-platform)). Secondary sources say it was then sunset as a standalone product; that is unverified against a primary source.

### ReviewVis (Fregnan, Fröhlich, Spadini, Bacchelli)

- Published as "Graph-based visualization of merge requests for code review", *Journal of Systems and Software*, 2023 ([ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0164121222001820); [replication package with tool](https://zenodo.org/records/7047993)).
- Classes and methods are graph nodes, and structural coupling (calls, inheritance) forms the links. Each node shows whether it was added, deleted or changed in the MR. Related entities that are *not* in the change can be shown as context.
- The data model comes from the follow-up UZH thesis that extended the tool to Python ([Improving CodeDiffVis](https://capuana.ifi.uzh.ch/publications/PDFs/22544_Improving_CodeDiffVis_for_Code_Review_Visualizations.pdf), §5.1). The tool has two parts: `CodeDiffParser` produces a JSON graph and `CodeDiffVis` renders it.
- **Node fields:** file path, name, enclosing entities, package/module, type, old *and* new position in the file, **status (`added`, `changed`, `unchanged`, `deleted`)**, parent node id, own id, and language.
- **Node types:** `CLASS`, `METHOD`, `FUNCTION`, `METHOD_REFERENCE`, `FUNCTION_REFERENCE`, `SCRIPT`, `TOOLERROR`, `UNKNOWNFILE`.
- **Link fields:** source id, target id, relation type, **status (same four values)**, and id.
- **Link types:** `SUPERCLASS`, `ENCLOSING_CLASS`, `METHOD` (containment), `METHOD_CALL`, `FUNCTION`, `FUNCTION_CALL`, `TOOLERROR`.
- Unresolvable calls become explicit `TOOLERROR` nodes and links instead of being silently dropped.

**Takeaway for AISF.**
- ReviewVis is the closest match to what the Strukturblatt needs at Levels 2 and 3. It uses one merged graph in which *every node and every edge* carries a four-valued status. It keeps old and new source positions, which is what a Level 3 source diff needs. It includes a parent id, which gives the zoom path.
- CodeSee shows the Level 1 equivalent: unchanged neighbours are drawn as context, and edges are coloured as added or removed.
- Both show AISF's map decision in practice: draw everything, highlight the changes.

## 6. Stable identifiers for code elements (Levels 2 and 3)

None of the architecture tools gives a language-neutral ID for classes and methods. Sourcegraph's **SCIP** symbol grammar does ([scip.proto](https://github.com/sourcegraph/scip/blob/main/scip.proto)):

- The grammar is `<scheme> <manager> <package-name> <version> <descriptor>+`.
- Descriptor suffixes mark the kind: `/` namespace, `#` type, `.` term, `(disambiguator).` method, `[T]` type parameter, `(p)` parameter.
- The descriptors "together form a fully qualified name … unique identifier across the package".
- One grammar covers TypeScript, Java and Dart. Existing SCIP indexers (e.g. scip-typescript, scip-java) could supply these IDs later.

---

## Comparison

| | Entity kinds | Identity | Edge typing | Roll-up to parent level | Diff between refs |
|---|---|---|---|---|---|
| Spring Modulith | module, named interface, type; events, beans, aggregates on the canvas | package-derived string, `module :: iface` | closed enum of 4 kinds; each module edge keeps the (sourceType, targetType) pair | module edges derived from type edges | none |
| Structurizr / C4 | fixed: person, system, container, component (+ deployment) | sequential int `id` (unstable) + type-prefixed canonical path + DSL identifier | free text + tags + sync/async | implied relationships, `linkedRelationshipId` | none (layout merge matches by canonical name → name → description → id) |
| LikeC4 | user-declared kinds | dotted FQN | user-declared relationship kinds | merged/derived relationships in views | none |
| dependency-cruiser | file module (folders via collapse) | resolved path | 40-value `dependencyTypes[]` + flags | `ddot`/`archi`/`--collapse` regex | changed files + dependents on one snapshot; removed edges not shown |
| CodeSee Review Maps | file, folder | path | plain dependency | folder collapse | node status added/modified/removed/impacted; edge status added/removed |
| ReviewVis | class, method, function, script, error | node id + parent id | 7 link kinds | parent link (containment) | node and link status added/changed/unchanged/deleted; old+new positions |

## Recommendation for AISF

Adopt the following in the model design (the next ticket, [#62](https://github.com/MoritzKopmann/AISoftwareFactory/issues/62)):

1. **One containment tree, open kinds** (LikeC4, C4).
   - A snapshot is a tree of *elements*, each with a `kind` from a declared vocabulary. The base kinds are `system` (L0), `module` (L1), `type` (L2) and `member` (L3), plus `external` for L0 callers and targets.
   - **Layers are attributes, not containers.** An element belongs to one module (the column) and has a `layer` value (the band), assigned by the project rule set. The Level 1 grid is therefore a module × layer projection of the same tree.
2. **Path-based, deterministic IDs** (LikeC4 FQN, Structurizr canonical name, SCIP descriptors).
   - The ID is the containment path, e.g. `module:review/type:ReviewService/member:approve(1)`, built from source facts only. Never use sequential or generated IDs, because they cannot survive a re-analysis at another ref.
   - For members, reuse SCIP-style suffixes and disambiguators so the same grammar serves TypeScript, Dart and Java.
   - The `module` segment comes from the project rule set (path patterns, as with dependency-cruiser's collapse). File paths are *properties*, not identity.
3. **Record edges at the finest resolved level, then derive coarser ones** (Structurizr implied relationships, LikeC4 merged relationships, Modulith's source/target type pair).
   - The analyzer emits type- and member-level edges.
   - Level 1 module edges and module × layer edges are *derived* aggregates. Each keeps its list of contributing fine edges, like `linkedRelationshipId`, so any Level 1 arrow can be drilled into Levels 2 and 3.
4. **Typed edges from a small closed core with an extension slot** (Modulith `DependencyType`, dependency-cruiser `dependencyTypes[]`, ReviewVis link types).
   - Core kinds: `uses` (call/reference), `extends`/`implements`, `injects`, `publishes`/`listens` (event channel), `contains`.
   - Each edge also carries a *set* of flags such as `type-only`, `dynamic` and `unresolved`.
   - Rule evaluation writes a separate `verdict` (ok / layer-violation / skips-layer / non-public-cross-module) rather than a new kind.
5. **Events as first-class elements** (Modulith canvas, Strukturblatt event channel). An `event` element lives in its owning module. `publishes` and `listens` edges connect to it, which lets the channel under the Level 1 grid show module → event → module.
6. **Diff = a merged graph with a status on every node and every edge** (ReviewVis, CodeSee).
   - Compute two snapshots (base and head), match them by ID, and emit one graph. Each element and edge gets `status ∈ {added, removed, changed, unchanged}`, and `changed` carries a small list of what changed (properties, children, source span).
   - Removed edges must stay in the graph, because that is where file-level highlighting (dependency-cruiser `--affected`) falls short.
   - Keep old and new source spans on members for the Level 3 source diff (ReviewVis positions).
   - Derived Level 1 edges get their status from their contributing fine edges.
7. **Renames and moves as a fallback matching pass** (Structurizr `DefaultLayoutMergeStrategy`). After exact ID matching, try to pair unmatched removed and added elements of the same kind. Match on name alone (the parent moved), then on content or git-rename evidence (the element was renamed). Flag these pairs as `moved`/`renamed` instead of showing a remove plus an add.
8. **Make analysis gaps explicit** (ReviewVis `TOOLERROR`, dependency-cruiser `couldNotResolve`). Unresolved references become flagged edges or elements, so the view can show uncertainty. This matches the map's "flagged when uncertain" for Level 0.

Do **not** adopt Structurizr's fixed C4 kinds or its numeric IDs. Do not adopt dependency-cruiser's single-snapshot "affected" highlighting as the diff model.

## Open questions surfaced

- **Extraction backend for the TypeScript adapter.** Options are dependency-cruiser's JSON (module-level only), the TypeScript compiler API or ts-morph (types and members), or scip-typescript (symbols and references). The choice decides how far Level 2 and 3 edges can be resolved.
- **How the rule set assigns module and layer.** Candidates are path regexes (as in dependency-cruiser `collapse`) or package annotations (as in Spring Modulith `@ApplicationModule` and `@NamedInterface`). Does AISF need a "named interface" / public API concept to judge horizontal edges, as the Strukturblatt's "valid only on public API" suggests?
- **Rename/move detection policy.** Is git's rename detection plus name matching enough, or does AISF need content similarity? Should a moved type count as a change to both modules?
- **Snapshot caching.** Should snapshots be cached per commit SHA? dependency-cruiser keys its cache by SHA with content checksums, which suggests the diff cost can be amortised across a PR's commits.
