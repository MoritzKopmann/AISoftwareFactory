import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../../../..');
const dependencyCruiserCli = join(
  repositoryRoot,
  'node_modules/dependency-cruiser/bin/dependency-cruiser.mjs',
);
const dependencyCruiserConfig = join(repositoryRoot, '.dependency-cruiser.cjs');
const sourceRoot = 'packages/app/src';

type CruiseResult = { readonly passed: boolean; readonly output: string };

describe('dependency-cruiser module rules', () => {
  let projectDirectory: string;

  beforeEach(() => {
    projectDirectory = mkdtempSync(join(tmpdir(), 'aisf-dependency-rules-'));
    writeProjectFile('tsconfig.base.json', tsconfigContent);
  });

  afterEach(() => {
    rmSync(projectDirectory, { recursive: true, force: true });
  });

  const tsconfigContent = JSON.stringify({
    compilerOptions: { module: 'NodeNext', moduleResolution: 'NodeNext' },
  });

  function writeProjectFile(relativePath: string, content: string): void {
    const absolutePath = join(projectDirectory, relativePath);
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, content);
  }

  function runCruise(): CruiseResult {
    const result = spawnSync(
      process.execPath,
      [dependencyCruiserCli, '--config', dependencyCruiserConfig, 'packages'],
      { cwd: projectDirectory, encoding: 'utf8' },
    );
    return { passed: result.status === 0, output: result.stdout + result.stderr };
  }

  function cruise(files: Readonly<Record<string, string>>): CruiseResult {
    for (const [relativePath, content] of Object.entries(files)) {
      writeProjectFile(`${sourceRoot}/${relativePath}`, content);
    }
    return runCruise();
  }

  function cruiseAcrossPackages(files: Readonly<Record<string, string>>): CruiseResult {
    for (const [relativePath, content] of Object.entries(files)) {
      writeProjectFile(relativePath, content);
    }
    return runCruise();
  }

  const exported = 'export const value = 1;\n';

  describe('modules-only-through-index', () => {
    it('should fail when a module deep-imports another module', () => {
      const result = cruise({
        'modules/scheduler/index.ts': "import '../watcher/logic/domain/types/snapshot.js';\n",
        'modules/watcher/index.ts': exported,
        'modules/watcher/logic/domain/types/snapshot.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('modules-only-through-index');
    });

    it('should pass when a module imports another module through its index', () => {
      const result = cruise({
        'modules/scheduler/index.ts': "import '../watcher/index.js';\n",
        'modules/watcher/index.ts': exported,
      });

      expect(result.passed).toBe(true);
    });

    it('should pass when a module imports its own layers', () => {
      const result = cruise({
        'modules/watcher/index.ts': "import './api/routes/snapshots.js';\n",
        'modules/watcher/api/routes/snapshots.ts':
          "import '../../logic/domain/types/snapshot.js';\n",
        'modules/watcher/logic/domain/types/snapshot.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('outside-only-through-index', () => {
    it('should fail when shared code deep-imports a module', () => {
      const result = cruise({
        'shared/helper.ts': "import '../modules/watcher/logic/domain/types/snapshot.js';\n",
        'modules/watcher/index.ts': exported,
        'modules/watcher/logic/domain/types/snapshot.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('outside-only-through-index');
    });
  });

  describe('logic-no-infra-or-api', () => {
    it('should fail when logic imports infra', () => {
      const result = cruise({
        'modules/watcher/logic/use-cases/poll.ts': "import '../../infra/repositories/store.js';\n",
        'modules/watcher/infra/repositories/store.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('logic-no-infra-or-api');
    });

    it('should fail when logic imports api', () => {
      const result = cruise({
        'modules/watcher/logic/use-cases/poll.ts': "import '../../api/routes/snapshots.js';\n",
        'modules/watcher/api/routes/snapshots.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('logic-no-infra-or-api');
    });

    it('should pass when infra imports logic', () => {
      const result = cruise({
        'modules/watcher/infra/repositories/store.ts': "import '../../logic/ports/store.js';\n",
        'modules/watcher/logic/ports/store.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('logic-no-other-module', () => {
    it('should fail when logic deep-imports another module', () => {
      const result = cruise({
        'modules/scheduler/logic/use-cases/start.ts':
          "import '../../../watcher/logic/domain/types/snapshot.js';\n",
        'modules/watcher/index.ts': exported,
        'modules/watcher/logic/domain/types/snapshot.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('logic-no-other-module');
    });

    it('should fail when logic imports another module through its index', () => {
      const result = cruise({
        'modules/scheduler/logic/use-cases/start.ts': "import '../../../watcher/index.js';\n",
        'modules/watcher/index.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('logic-no-other-module');
    });

    it('should pass when logic imports its own ports', () => {
      const result = cruise({
        'modules/scheduler/logic/use-cases/start.ts': "import '../ports/clock.js';\n",
        'modules/scheduler/logic/ports/clock.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('ui-only-api-schemas-from-app', () => {
    it('should fail when packages/ui imports something other than an api schema from packages/app', () => {
      const result = cruiseAcrossPackages({
        'packages/ui/src/main.ts': "import '../../app/src/modules/ui/index.js';\n",
        'packages/app/src/modules/ui/index.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('ui-only-api-schemas-from-app');
    });

    it('should pass when packages/ui imports an api schema from packages/app', () => {
      const result = cruiseAcrossPackages({
        'packages/ui/src/main.ts':
          "import '../../app/src/modules/ui/api/schemas/projects-schemas.js';\n",
        'packages/app/src/modules/ui/api/schemas/projects-schemas.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('infra-only-from-main', () => {
    it('should fail when an api adapter imports infra', () => {
      const result = cruise({
        'modules/watcher/api/routes/snapshots.ts': "import '../../infra/repositories/store.js';\n",
        'modules/watcher/infra/repositories/store.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('infra-only-from-main');
    });

    it('should fail when shared code imports infra', () => {
      const result = cruise({
        'shared/helper.ts': "import '../modules/watcher/infra/repositories/store.js';\n",
        'modules/watcher/infra/repositories/store.ts': exported,
      });

      expect(result.passed).toBe(false);
    });

    it('should pass when main imports infra', () => {
      const result = cruise({
        'main.ts': "import './modules/watcher/infra/repositories/store.js';\n",
        'modules/watcher/infra/repositories/store.ts': exported,
      });

      expect(result.passed).toBe(true);
    });

    it('should fail when main imports module logic', () => {
      const result = cruise({
        'main.ts': "import './modules/watcher/logic/domain/types/snapshot.js';\n",
        'modules/watcher/logic/domain/types/snapshot.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('main-only-through-index-and-infra');
    });
  });

  describe('domain-only-domain', () => {
    it('should fail when domain imports ports', () => {
      const result = cruise({
        'modules/watcher/logic/domain/functions/diff.ts': "import '../../ports/store.js';\n",
        'modules/watcher/logic/ports/store.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('domain-only-domain');
    });

    it('should fail when domain imports shared', () => {
      const result = cruise({
        'modules/watcher/logic/domain/types/snapshot.ts':
          "import type { Clock } from '../../../../../shared/clock.js';\nexport type Snapshot = Clock;\n",
        'shared/clock.ts': 'export type Clock = number;\n',
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('domain-only-domain');
    });
  });

  describe('domain-types-only-types', () => {
    it('should fail when a domain type imports a constant', () => {
      const result = cruise({
        'modules/watcher/logic/domain/types/snapshot.ts': "import '../constants/labels.js';\n",
        'modules/watcher/logic/domain/constants/labels.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('domain-types-only-types');
    });

    it('should pass when a domain type imports another type', () => {
      const result = cruise({
        'modules/watcher/logic/domain/types/snapshot.ts': "import './ticket.js';\n",
        'modules/watcher/logic/domain/types/ticket.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('domain-constants-only-types', () => {
    it('should fail when a domain constant imports a function', () => {
      const result = cruise({
        'modules/watcher/logic/domain/constants/labels.ts': "import '../functions/diff.js';\n",
        'modules/watcher/logic/domain/functions/diff.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('domain-constants-only-types');
    });

    it('should pass when a domain constant imports a type', () => {
      const result = cruise({
        'modules/watcher/logic/domain/constants/labels.ts': "import '../types/label.js';\n",
        'modules/watcher/logic/domain/types/label.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('domain functions', () => {
    it('should fail when a domain function imports a use case', () => {
      const result = cruise({
        'modules/watcher/logic/domain/functions/diff.ts': "import '../../use-cases/poll.js';\n",
        'modules/watcher/logic/use-cases/poll.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('domain-only-domain');
    });

    it('should pass when a domain function imports a constant', () => {
      const result = cruise({
        'modules/watcher/logic/domain/functions/diff.ts': "import '../constants/labels.js';\n",
        'modules/watcher/logic/domain/constants/labels.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('domain-no-barrel', () => {
    it('should fail when something imports a domain subfolder index', () => {
      const result = cruise({
        'modules/watcher/logic/use-cases/poll.ts': "import '../domain/types/index.js';\n",
        'modules/watcher/logic/domain/types/index.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('domain-no-barrel');
    });
  });

  describe('logic-shared-types-only', () => {
    it('should fail when logic imports a value from shared', () => {
      const result = cruise({
        'modules/watcher/logic/use-cases/poll.ts': "import '../../../../shared/clock.js';\n",
        'shared/clock.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('logic-shared-types-only');
    });

    it('should pass when logic imports a type from shared', () => {
      const result = cruise({
        'modules/watcher/logic/use-cases/poll.ts':
          "import type { Clock } from '../../../../shared/clock.js';\nexport type Poll = Clock;\n",
        'shared/clock.ts': 'export type Clock = number;\n',
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('use-cases-only-domain-ports-errors', () => {
    it('should fail when a use case imports another use case', () => {
      const result = cruise({
        'modules/watcher/logic/use-cases/poll.ts': "import './refresh.js';\n",
        'modules/watcher/logic/use-cases/refresh.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('use-cases-only-domain-ports-errors');
    });

    it('should pass when a use case imports domain, ports and errors', () => {
      const result = cruise({
        'modules/watcher/logic/use-cases/poll.ts':
          "import '../domain/types/snapshot.js';\nimport '../ports/store.js';\nimport '../errors/missing-error.js';\n",
        'modules/watcher/logic/domain/types/snapshot.ts': exported,
        'modules/watcher/logic/ports/store.ts': exported,
        'modules/watcher/logic/errors/missing-error.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('infra-logic-only-ports-domain-errors', () => {
    it('should fail when infra imports a use case', () => {
      const result = cruise({
        'modules/watcher/infra/repositories/store.ts': "import '../../logic/use-cases/poll.js';\n",
        'modules/watcher/logic/use-cases/poll.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('infra-logic-only-ports-domain-errors');
    });

    it('should pass when infra imports ports, domain and errors', () => {
      const result = cruise({
        'modules/watcher/infra/repositories/store.ts':
          "import '../../logic/ports/store.js';\nimport '../../logic/domain/types/snapshot.js';\nimport '../../logic/errors/missing-error.js';\n",
        'modules/watcher/logic/ports/store.ts': exported,
        'modules/watcher/logic/domain/types/snapshot.ts': exported,
        'modules/watcher/logic/errors/missing-error.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('api-logic-only-use-cases-domain-errors', () => {
    it('should fail when an api adapter imports a port', () => {
      const result = cruise({
        'modules/watcher/api/routes/snapshots.ts': "import '../../logic/ports/store.js';\n",
        'modules/watcher/logic/ports/store.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('api-logic-only-use-cases-domain-errors');
    });

    it('should pass when an api adapter imports a use case, a domain type and an error', () => {
      const result = cruise({
        'modules/watcher/api/routes/snapshots.ts':
          "import '../../logic/use-cases/poll.js';\nimport '../../logic/domain/types/snapshot.js';\nimport '../../logic/errors/missing-error.js';\n",
        'modules/watcher/logic/use-cases/poll.ts': exported,
        'modules/watcher/logic/domain/types/snapshot.ts': exported,
        'modules/watcher/logic/errors/missing-error.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });
});
