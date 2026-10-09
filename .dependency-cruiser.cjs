const modulesRoot = '^packages/app/src/modules';
const moduleIndexFile = `${modulesRoot}/[^/]+/index\\.ts$`;
const logicRoot = `${modulesRoot}/[^/]+/logic`;
const domainRoot = `${logicRoot}/domain`;
const sharedRoot = '^packages/app/src/shared/';
const sharedDomainConcepts = '^packages/app/src/shared/(ticket-status|ticket-type)/';
const mainFile = '^packages/app/src/main\\.ts$';

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
      comment: 'main.ts imports a module through its index.ts and its infra/, nothing else.',
      severity: 'error',
      from: { path: mainFile },
      to: { path: `${modulesRoot}/`, pathNot: [moduleIndexFile, `${modulesRoot}/[^/]+/infra/`] },
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
          '^packages/app/src/shared/http/schemas/',
        ],
      },
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
