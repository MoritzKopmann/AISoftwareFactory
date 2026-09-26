const modulesRoot = '^packages/app/src/modules';
const moduleIndexFile = `${modulesRoot}/[^/]+/index\\.ts$`;
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
      name: 'infra-only-from-main',
      comment: 'Only main.ts imports infra/ from outside infra/.',
      severity: 'error',
      from: { path: [`${modulesRoot}/[^/]+/(api|logic)/`, moduleIndexFile] },
      to: { path: `${modulesRoot}/[^/]+/infra/` },
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
