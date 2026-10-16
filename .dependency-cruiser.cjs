const modulesRoot = '^packages/app/src/modules';
const moduleIndexFile = `${modulesRoot}/[^/]+/index\\.ts$`;
const domainRoot = `${modulesRoot}/[^/]+/business/domain`;
// The layered layout of `project-architecture`. Rule names carry the IDs of its rules.
const layerModule = `${modulesRoot}/([^/]+)/`; // $1 = module name
const inLayers = `${layerModule}(presentation|business|infrastructure)/`;
const notTest = ['\\.test\\.ts$', `${modulesRoot}/[^/]+/testing/`];
const sharedTypeConcepts =
  '^packages/app/src/shared/ticket-(status/ticket-status|type/ticket-type)\\.ts$';
const sharedTypeOnlyPorts =
  '^packages/app/src/shared/((clock|identifiers|logger)/|agent-tools\\.ts$)';
const sharedRoot = '^packages/app/src/shared/';
const compositionRootFile = '^packages/app/src/composition-root\\.ts$';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'B1-modules-only-through-index',
      comment: 'A module reaches another module only through its index.ts.',
      severity: 'error',
      from: { path: `${modulesRoot}/([^/]+)/` },
      to: { path: `${modulesRoot}/[^/]+/`, pathNot: [`${modulesRoot}/$1/`, moduleIndexFile] },
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
      name: 'ui-only-api-schemas-from-app',
      comment: 'packages/ui imports @aisf/app only through its published API schemas.',
      severity: 'error',
      from: { path: '^packages/ui/' },
      to: {
        path: '^packages/app/',
        pathNot: [
          '^packages/app/src/modules/[^/]+/presentation/dto/api/',
          '^packages/app/src/shared/http\\.ts$',
        ],
      },
    },
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
      name: 'W1-composition-root-imports-only-indexes-and-shared',
      comment: 'composition-root.ts imports only module index.ts files and shared/.',
      severity: 'error',
      from: { path: compositionRootFile },
      to: {
        path: '^packages/app/src/',
        pathNot: [moduleIndexFile, sharedRoot, compositionRootFile],
      },
    },
    {
      name: 'W2-in-memory-implementations-only-in-composition-root',
      comment:
        'Shared in-memory implementations are created only in composition-root.ts. Tests and testing/ folders are exempt.',
      severity: 'error',
      from: {
        pathNot: [compositionRootFile, ...notTest, '^packages/app/src/shared/in-memory-'],
      },
      to: { path: '^packages/app/src/shared/in-memory-[^/]+\\.ts$' },
    },
    {
      name: 'G1-no-circular',
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
