// Enforces the architecture rules (references/rules.md in the layered-architecture skill). Run: npm run lint:arch
// Rule names match the [IDs] in the rules.
const M = "^src/modules/([^/]+)/"; // $1 = module name
const notTest = "\\.test\\.ts$";

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // ---------- layers ----------
    {
      name: "L1-business-is-the-core",
      comment: "business/ may import only its own business/, shared/errors.ts, shared/event-bus.ts and Node built-ins.",
      severity: "error",
      from: { path: `${M}business/`, pathNot: notTest },
      to: { pathNot: ["^src/modules/$1/business/", "^src/shared/(errors|event-bus)\\.ts$"], dependencyTypesNot: ["core"] },
    },
    {
      name: "L2-domain-is-pure",
      comment: "business/domain/ imports only business/domain/.",
      severity: "error",
      from: { path: `${M}business/domain/` },
      to: { pathNot: ["^src/modules/$1/business/domain/"] },
    },
    {
      name: "L3-presentation-skips-infrastructure",
      severity: "error",
      from: { path: `${M}presentation/` },
      to: { path: "^src/modules/$1/infrastructure/" },
    },
    {
      name: "L4-infrastructure-not-upward",
      severity: "error",
      from: { path: `${M}infrastructure/` },
      to: { path: "^src/modules/$1/presentation/" },
    },
    {
      name: "L5-presentation-entry-points-are-independent",
      comment: "presentation/api, /internal, /bus, /cli, ... may share presentation/dto but not import each other.",
      severity: "error",
      from: { path: `${M}presentation/([^/]+)/` },
      to: { path: "^src/modules/$1/presentation/", pathNot: ["^src/modules/$1/presentation/($2|dto)/"] },
    },
    {
      name: "L6-dto-is-data-only",
      comment: "presentation/dto/ imports only dto/ and (for mappers) business/domain/.",
      severity: "error",
      from: { path: `${M}presentation/dto/` },
      to: { pathNot: ["^src/modules/$1/presentation/dto/", "^src/modules/$1/business/domain/"] },
    },
    {
      name: "L7-dto-without-mapper-imports-no-domain",
      comment: "Only presentation/dto/mapper/ may know entities; plain DTO files must not.",
      severity: "error",
      from: { path: `${M}presentation/dto/`, pathNot: `${M}presentation/dto/mapper/` },
      to: { path: "^src/modules/$1/business/" },
    },
    {
      name: "L9-internal-api-uses-internal-dtos",
      comment: "presentation/internal/ must not use HTTP DTOs (dto/api/).",
      severity: "error",
      from: { path: `${M}presentation/internal/` },
      to: { path: "^src/modules/$1/presentation/dto/api/" },
    },
    {
      name: "L10-http-api-uses-api-dtos",
      comment: "presentation/api/ must not use internal DTOs (dto/internal/).",
      severity: "error",
      from: { path: `${M}presentation/api/` },
      to: { path: "^src/modules/$1/presentation/dto/internal/" },
    },
    {
      name: "L11-dto-families-are-separate",
      comment: "dto/api/ and dto/internal/ never import each other; only dto/mapper/ sees both.",
      severity: "error",
      from: { path: `${M}presentation/dto/(api|internal)/` },
      to: { path: "^src/modules/$1/presentation/dto/", pathNot: "^src/modules/$1/presentation/dto/$2/" },
    },
    {
      name: "L8-http-only-in-presentation-api",
      severity: "error",
      from: { path: "^src/modules/", pathNot: `${M}presentation/api/` },
      to: { path: "^src/shared/http\\.ts$" },
    },
    // ---------- module boundaries ----------
    {
      name: "B1-other-modules-only-via-index",
      severity: "error",
      from: { path: M },
      to: { path: "^src/modules/([^/]+)/.+", pathNot: ["^src/modules/$1/", "^src/modules/[^/]+/index\\.ts$"] },
    },
    {
      name: "B2-other-modules-only-from-infrastructure-internal",
      comment: "Only infrastructure/internal/ and index.ts may reference another module.",
      severity: "error",
      from: { path: M, pathNot: [`${M}infrastructure/internal/`, `${M}index\\.ts$`] },
      to: { path: "^src/modules/([^/]+)/index\\.ts$", pathNot: "^src/modules/$1/" },
    },
    {
      name: "B3-nothing-inside-imports-own-index",
      severity: "error",
      from: { path: M, pathNot: [`${M}index\\.ts$`, notTest] },
      to: { path: "^src/modules/$1/index\\.ts$" },
    },
    // ---------- wiring ----------
    {
      name: "W1-root-sees-only-module-entries",
      comment: "composition-root.ts imports only modules' index.ts and shared/.",
      severity: "error",
      from: { path: "^src/composition-root\\.ts$" },
      to: { path: "^src/modules/", pathNot: "^src/modules/[^/]+/index\\.ts$" },
    },
    {
      name: "W2-shared-implementations-only-in-root",
      severity: "error",
      from: { path: "^src/modules/", pathNot: notTest },
      to: { path: "^src/shared/in-memory-" },
    },
    // ---------- shared / general ----------
    {
      name: "S1-shared-imports-no-modules",
      severity: "error",
      from: { path: "^src/shared/" },
      to: { path: "^src/(modules/|composition-root|main)" },
    },
    {
      name: "G1-no-cycles",
      comment: "Also catches module-level cycles (users <-> orders), which the composition root could not wire anyway.",
      severity: "error",
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    tsConfig: { fileName: "tsconfig.json" },
    tsPreCompilationDeps: true,
    doNotFollow: { path: "node_modules" },
    enhancedResolveOptions: { extensions: [".ts", ".js"] },
  },
};
