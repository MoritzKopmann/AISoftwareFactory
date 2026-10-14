const modulesRoot = '^packages/app/src/modules';
const moduleIndexFile = `${modulesRoot}/[^/]+/index\\.ts$`;
const logicRoot = `${modulesRoot}/[^/]+/logic`;
// The domain folder of the old (logic/) and the new (business/) layout.
const domainRoot = `${modulesRoot}/[^/]+/(logic|business)/domain`;
// The new layered layout, `project-architecture`. Rule names carry the IDs of its example app.
const layerModule = `${modulesRoot}/([^/]+)/`; // $1 = module name
const inLayers = `${layerModule}(presentation|business|infrastructure)/`;
const notTest = ['\\.test\\.ts$', `${modulesRoot}/[^/]+/testing/`];
const sharedTypeConcepts =
  '^packages/app/src/shared/ticket-(status/ticket-status|type/ticket-type)\\.ts$';
const sharedTypeOnlyPorts = '^packages/app/src/shared/(clock|identifiers|logger|agent-tools)/';
const sharedRoot = '^packages/app/src/shared/';
const sharedDomainConcepts = '^packages/app/src/shared/(ticket-status|ticket-type)/';
const mainFile = '^packages/app/src/(main|composition-root)\\.ts$';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'modules-only-through-index',
      comment: 'A module reaches another module only through its index.ts.',
      severity: 'error',
      from: { path: `${modulesRoot}/([^/]+)/` },
      to: { path: `${modulesRoot}/[^/]+/`, pathNot: [`${modulesRoot}/$1/`, moduleIndexFile] },
    },
    {
      name: 'outside-only-through-index',
      comment: 'Code outside the modules (shared/) reaches a module only through its index.ts.',
      severity: 'error',
      from: { path: '^packages/app/src/', pathNot: [`${modulesRoot}/`, mainFile] },
      to: { path: `${modulesRoot}/`, pathNot: moduleIndexFile },
    },
    {
      name: 'main-only-through-index-and-infra',
      comment:
        'main.ts and composition-root.ts import a module through its index.ts and its infra/, nothing else. Until the old layout is dropped.',
      severity: 'error',
      from: { path: mainFile },
      to: {
        path: `${modulesRoot}/`,
        pathNot: [moduleIndexFile, `${modulesRoot}/[^/]+/(infra|infrastructure)/`],
      },
    },
    {
      name: 'logic-no-infra-or-api',
      comment: 'logic/ depends on neither infra/ nor api/.',
      severity: 'error',
      from: { path: `${modulesRoot}/[^/]+/logic/` },
      to: { path: `${modulesRoot}/[^/]+/(infra|api)/` },
    },
    {
      name: 'logic-no-other-module',
      comment:
        "A module's logic/ never imports another module, not even through its index.ts. Dependencies come in through ports that main.ts fills in.",
      severity: 'error',
      from: { path: `${modulesRoot}/([^/]+)/logic/` },
      to: { path: `${modulesRoot}/[^/]+/`, pathNot: [`${modulesRoot}/$1/`] },
    },
    {
      name: 'domain-only-domain',
      comment:
        "domain/ imports nothing but domain/: not ports/, use-cases/, errors/ or shared/, except shared/'s domain concepts.",
      severity: 'error',
      from: { path: `${domainRoot}/` },
      to: {
        path: [`${logicRoot}/(ports|use-cases|errors)/`, sharedRoot],
        pathNot: sharedDomainConcepts,
      },
    },
    {
      name: 'domain-types-only-types',
      comment: 'domain/types/ imports only domain/types/.',
      severity: 'error',
      from: { path: `${domainRoot}/types/` },
      to: { path: `${domainRoot}/(constants|functions)/` },
    },
    {
      name: 'domain-constants-only-types',
      comment: 'domain/constants/ imports only domain/types/.',
      severity: 'error',
      from: { path: `${domainRoot}/constants/` },
      to: { path: `${domainRoot}/functions/` },
    },
    {
      name: 'domain-no-barrel',
      comment:
        'No barrel index.ts in a domain/ subfolder: importing one is forbidden. A barrel nobody imports is not caught.',
      severity: 'error',
      from: {},
      to: { path: `${domainRoot}/(types|functions|constants)/index\\.ts$` },
    },
    {
      name: 'logic-shared-types-only',
      comment: "logic/ imports only types from shared/, except shared/'s domain concepts.",
      severity: 'error',
      from: { path: `${logicRoot}/` },
      to: { path: sharedRoot, pathNot: sharedDomainConcepts, dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'use-cases-only-domain-ports-errors',
      comment:
        'use-cases/ import only domain/, ports/ and errors/ from logic/, never another use case.',
      severity: 'error',
      from: { path: `${logicRoot}/use-cases/` },
      to: { path: `${logicRoot}/use-cases/` },
    },
    {
      name: 'infra-logic-only-ports-domain-errors',
      comment: 'infra/ imports only ports/, domain/ and errors/ from logic/.',
      severity: 'error',
      from: { path: `${modulesRoot}/[^/]+/infra/` },
      to: { path: `${logicRoot}/use-cases/` },
    },
    {
      name: 'api-logic-only-use-cases-domain-errors',
      comment:
        'api/ imports only use-cases/, domain/ and errors/ from logic/, never a port. infra/ is covered by infra-only-from-main.',
      severity: 'error',
      from: { path: `${modulesRoot}/[^/]+/api/` },
      to: { path: `${logicRoot}/ports/` },
    },
    {
      name: 'infra-only-from-main',
      comment: 'Only main.ts imports infra/ from outside infra/.',
      severity: 'error',
      from: { path: [`${modulesRoot}/[^/]+/(api|logic)/`, moduleIndexFile] },
      to: { path: `${modulesRoot}/[^/]+/infra/` },
    },
    {
      name: 'ui-only-api-schemas-from-app',
      comment: 'packages/ui imports @aisf/app only through its published API schemas.',
      severity: 'error',
      from: { path: '^packages/ui/' },
      to: {
        path: '^packages/app/',
        pathNot: [
          '^packages/app/src/modules/[^/]+/api/schemas/',
          '^packages/app/src/modules/[^/]+/presentation/dto/api/',
        ],
      },
    },
    // Rules for the layered layout of project-architecture, beside the old rules.
    {
      name: 'L1-business-is-the-core',
      comment:
        'business/ imports only its own business/, shared/errors.ts, shared/event-bus.ts and Node built-ins. Named deviation: type-only shared types (see L1-business-shared-types-only).',
      severity: 'error',
      from: { path: `${layerModule}business/`, pathNot: notTest },
      to: {
        pathNot: [
          `${modulesRoot}/$1/business/`,
          '^packages/app/src/shared/(errors|event-bus)\\.ts$',
          sharedTypeOnlyPorts,
          sharedTypeConcepts,
        ],
        dependencyTypesNot: ['core'],
      },
    },
    {
      name: 'L1-business-shared-types-only',
      comment:
        'Named deviation from L1: business/ may import shared/{clock,identifiers,logger,agent-tools} and the ticket status and type files, as types only.',
      severity: 'error',
      from: { path: `${layerModule}business/`, pathNot: notTest },
      to: { path: [sharedTypeOnlyPorts, sharedTypeConcepts], dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'L2-domain-is-pure',
      comment:
        'business/domain/ imports only business/domain/. Named deviation: the TicketStatus and TicketType types (see L2-domain-shared-status-types-only).',
      severity: 'error',
      from: { path: `${layerModule}business/domain/` },
      to: { pathNot: [`${modulesRoot}/$1/business/domain/`, sharedTypeConcepts] },
    },
    {
      name: 'L2-domain-shared-status-types-only',
      comment:
        'Named deviation from L2: business/domain/ imports the TicketStatus and TicketType types, as types only.',
      severity: 'error',
      from: { path: `${layerModule}business/domain/` },
      to: { path: sharedTypeConcepts, dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'L3-presentation-skips-infrastructure',
      severity: 'error',
      from: { path: `${layerModule}presentation/` },
      to: { path: `${modulesRoot}/$1/infrastructure/` },
    },
    {
      name: 'L4-infrastructure-not-upward',
      severity: 'error',
      from: { path: `${layerModule}infrastructure/` },
      to: { path: `${modulesRoot}/$1/presentation/` },
    },
    {
      name: 'L5-presentation-entry-points-are-independent',
      comment:
        'presentation/api, /internal, /bus, ... may share presentation/dto but not import each other.',
      severity: 'error',
      from: { path: `${layerModule}presentation/([^/]+)/` },
      to: {
        path: `${modulesRoot}/$1/presentation/`,
        pathNot: `${modulesRoot}/$1/presentation/($2|dto)/`,
      },
    },
    {
      name: 'L6-dto-is-data-only',
      comment:
        'presentation/dto/ imports only dto/ and (for mappers) business/domain/. Named deviations: dto/api/ may import the npm package zod; dto/ may import shared/event-bus.ts (event names and payload types).',
      severity: 'error',
      from: { path: `${layerModule}presentation/dto/(?!api/)` },
      to: {
        pathNot: [
          `${modulesRoot}/$1/presentation/dto/`,
          `${modulesRoot}/$1/business/domain/`,
          '^packages/app/src/shared/event-bus\\.ts$',
        ],
      },
    },
    {
      name: 'L6-dto-api-is-data-only',
      comment: 'L6 for presentation/dto/api/, which also allows the npm package zod.',
      severity: 'error',
      from: { path: `${layerModule}presentation/dto/api/` },
      to: {
        pathNot: [
          `${modulesRoot}/$1/presentation/dto/`,
          `${modulesRoot}/$1/business/domain/`,
          '^packages/app/src/shared/event-bus\\.ts$',
          '(^|/)node_modules/zod/',
        ],
      },
    },
    {
      name: 'L7-dto-without-mapper-imports-no-domain',
      comment: 'Only presentation/dto/mapper/ may know entities; plain DTO files must not.',
      severity: 'error',
      from: {
        path: `${layerModule}presentation/dto/`,
        pathNot: `${layerModule}presentation/dto/mapper/`,
      },
      to: { path: `${modulesRoot}/$1/business/` },
    },
    {
      name: 'L8-http-only-in-presentation-api',
      comment: 'shared/http.ts is used only by presentation/api/.',
      severity: 'error',
      from: {
        path: `${modulesRoot}/[^/]+/(business|infrastructure|presentation/(?!api/))`,
      },
      to: { path: '^packages/app/src/shared/http\\.ts$' },
    },
    {
      name: 'L9-internal-api-uses-internal-dtos',
      comment: 'presentation/internal/ must not use HTTP DTOs (dto/api/).',
      severity: 'error',
      from: { path: `${layerModule}presentation/internal/` },
      to: { path: `${modulesRoot}/$1/presentation/dto/api/` },
    },
    {
      name: 'L10-http-api-uses-api-dtos',
      comment: 'presentation/api/ must not use internal DTOs (dto/internal/).',
      severity: 'error',
      from: { path: `${layerModule}presentation/api/` },
      to: { path: `${modulesRoot}/$1/presentation/dto/internal/` },
    },
    {
      name: 'L11-dto-families-are-separate',
      comment: 'dto/api/ and dto/internal/ never import each other; only dto/mapper/ sees both.',
      severity: 'error',
      from: { path: `${layerModule}presentation/dto/(api|internal)/` },
      to: {
        path: `${modulesRoot}/$1/presentation/dto/`,
        pathNot: `${modulesRoot}/$1/presentation/dto/$2/`,
      },
    },
    {
      name: 'B2-other-modules-only-from-infrastructure-internal',
      comment: 'Only infrastructure/internal/ and index.ts may reference another module.',
      severity: 'error',
      from: { path: inLayers, pathNot: `${layerModule}infrastructure/internal/` },
      to: { path: `${modulesRoot}/([^/]+)/index\\.ts$`, pathNot: `${modulesRoot}/$1/` },
    },
    {
      name: 'B3-nothing-inside-imports-own-index',
      severity: 'error',
      from: { path: inLayers, pathNot: '\\.test\\.ts$' },
      to: { path: `${modulesRoot}/$1/index\\.ts$` },
    },
    {
      name: 'S1-shared-imports-no-modules',
      severity: 'error',
      from: { path: sharedRoot },
      to: { path: '^packages/app/src/(modules/|composition-root|main)' },
    },
    {
      name: 'business-errors-only-shared-errors',
      comment: 'business/errors/ imports only shared/errors.ts.',
      severity: 'error',
      from: { path: `${layerModule}business/errors/`, pathNot: notTest },
      to: { pathNot: '^packages/app/src/shared/errors\\.ts$' },
    },
    {
      name: 'no-circular',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(node_modules|dist|coverage)/' },
    tsPreCompilationDeps: true,
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'node', 'default'],
    },
    tsConfig: { fileName: 'tsconfig.base.json' },
  },
};
