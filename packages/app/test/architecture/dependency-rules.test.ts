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
        'modules/scheduler/index.ts': "import '../watcher/logic/domain/snapshot.js';\n",
        'modules/watcher/index.ts': exported,
        'modules/watcher/logic/domain/snapshot.ts': exported,
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
        'modules/watcher/api/routes/snapshots.ts': "import '../../logic/domain/snapshot.js';\n",
        'modules/watcher/logic/domain/snapshot.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('outside-only-through-index', () => {
    it('should fail when shared code deep-imports a module', () => {
      const result = cruise({
        'shared/helper.ts': "import '../modules/watcher/logic/domain/snapshot.js';\n",
        'modules/watcher/index.ts': exported,
        'modules/watcher/logic/domain/snapshot.ts': exported,
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
          "import '../../../watcher/logic/domain/snapshot.js';\n",
        'modules/watcher/index.ts': exported,
        'modules/watcher/logic/domain/snapshot.ts': exported,
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
        'main.ts': "import './modules/watcher/logic/domain/snapshot.js';\n",
        'modules/watcher/logic/domain/snapshot.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('main-only-through-index-and-infra');
    });
  });
});
