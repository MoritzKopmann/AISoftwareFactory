import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const repositoryRoot = resolve(import.meta.dirname, '../../..');
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

  describe('layered rules', () => {
    const modulePath = 'modules/x';

    it.each([
      {
        rule: 'L1-business-is-the-core',
        title: 'business imports infrastructure',
        files: {
          [`${modulePath}/business/service/a-service.ts`]:
            "import '../../infrastructure/repository/b.js';\n",
          [`${modulePath}/infrastructure/repository/b.ts`]: exported,
        },
      },
      {
        rule: 'L1-business-is-the-core',
        title: 'business imports a shared value other than errors and the event bus',
        files: {
          [`${modulePath}/business/service/a-service.ts`]: "import '../../../../shared/http.js';\n",
          'shared/http.ts': exported,
        },
      },
      {
        rule: 'L1-business-shared-types-only',
        title: 'business imports a value from shared/clock',
        files: {
          [`${modulePath}/business/service/a-service.ts`]:
            "import '../../../../shared/clock/clock.js';\n",
          'shared/clock/clock.ts': exported,
        },
      },
      {
        rule: 'L2-domain-is-pure',
        title: 'domain imports a service',
        files: {
          [`${modulePath}/business/domain/a.ts`]: "import '../service/a-service.js';\n",
          [`${modulePath}/business/service/a-service.ts`]: exported,
        },
      },
      {
        rule: 'L2-domain-shared-status-types-only',
        title: 'domain imports a value from the ticket status',
        files: {
          [`${modulePath}/business/domain/a.ts`]:
            "import '../../../../shared/ticket-status/ticket-status.js';\n",
          'shared/ticket-status/ticket-status.ts': exported,
        },
      },
      {
        rule: 'L3-presentation-skips-infrastructure',
        title: 'presentation imports infrastructure',
        files: {
          [`${modulePath}/presentation/api/a.ts`]:
            "import '../../infrastructure/repository/b.js';\n",
          [`${modulePath}/infrastructure/repository/b.ts`]: exported,
        },
      },
      {
        rule: 'L4-infrastructure-not-upward',
        title: 'infrastructure imports presentation',
        files: {
          [`${modulePath}/infrastructure/repository/b.ts`]:
            "import '../../presentation/dto/api/a.js';\n",
          [`${modulePath}/presentation/dto/api/a.ts`]: exported,
        },
      },
      {
        rule: 'L5-presentation-entry-points-are-independent',
        title: 'one presentation entry point imports another',
        files: {
          [`${modulePath}/presentation/api/a.ts`]: "import '../bus/b.js';\n",
          [`${modulePath}/presentation/bus/b.ts`]: exported,
        },
      },
      {
        rule: 'L6-dto-is-data-only',
        title: 'a dto imports business',
        files: {
          [`${modulePath}/presentation/dto/mapper/a.ts`]:
            "import '../../../business/service/s.js';\n",
          [`${modulePath}/business/service/s.ts`]: exported,
        },
      },
      {
        rule: 'L7-dto-without-mapper-imports-no-domain',
        title: 'a plain dto imports the domain',
        files: {
          [`${modulePath}/presentation/dto/api/a.ts`]: "import '../../../business/domain/d.js';\n",
          [`${modulePath}/business/domain/d.ts`]: exported,
        },
      },
      {
        rule: 'L8-http-only-in-presentation-api',
        title: 'a presentation bus subscriber imports shared/http',
        files: {
          [`${modulePath}/presentation/bus/a.ts`]: "import '../../../../shared/http.js';\n",
          'shared/http.ts': exported,
        },
      },
      {
        rule: 'L9-internal-api-uses-internal-dtos',
        title: 'the internal api imports an http dto',
        files: {
          [`${modulePath}/presentation/internal/a.ts`]: "import '../dto/api/d.js';\n",
          [`${modulePath}/presentation/dto/api/d.ts`]: exported,
        },
      },
      {
        rule: 'L10-http-api-uses-api-dtos',
        title: 'the http api imports an internal dto',
        files: {
          [`${modulePath}/presentation/api/a.ts`]: "import '../dto/internal/d.js';\n",
          [`${modulePath}/presentation/dto/internal/d.ts`]: exported,
        },
      },
      {
        rule: 'L11-dto-families-are-separate',
        title: 'an api dto imports an internal dto',
        files: {
          [`${modulePath}/presentation/dto/api/a.ts`]: "import '../internal/d.js';\n",
          [`${modulePath}/presentation/dto/internal/d.ts`]: exported,
        },
      },
      {
        rule: 'B2-other-modules-only-from-infrastructure-internal',
        title: 'a service imports another module',
        files: {
          [`${modulePath}/business/service/a-service.ts`]: "import '../../../y/index.js';\n",
          'modules/y/index.ts': exported,
        },
      },
      {
        rule: 'B3-nothing-inside-imports-own-index',
        title: 'a service imports its own index',
        files: {
          [`${modulePath}/business/service/a-service.ts`]: "import '../../index.js';\n",
          [`${modulePath}/index.ts`]: exported,
        },
      },
      {
        rule: 'S1-shared-imports-no-modules',
        title: 'shared imports a module index',
        files: {
          'shared/helper.ts': "import '../modules/x/index.js';\n",
          [`${modulePath}/index.ts`]: exported,
        },
      },
      {
        rule: 'business-errors-only-shared-errors',
        title: 'a business error imports a domain type',
        files: {
          [`${modulePath}/business/errors/a-error.ts`]: "import '../domain/d.js';\n",
          [`${modulePath}/business/domain/d.ts`]: exported,
        },
      },
      {
        rule: 'domain-types-only-types',
        title: 'a business domain type imports a function',
        files: {
          [`${modulePath}/business/domain/types/a.ts`]: "import '../functions/f.js';\n",
          [`${modulePath}/business/domain/functions/f.ts`]: exported,
        },
      },
      {
        rule: 'domain-constants-only-types',
        title: 'a business domain constant imports a function',
        files: {
          [`${modulePath}/business/domain/constants/a.ts`]: "import '../functions/f.js';\n",
          [`${modulePath}/business/domain/functions/f.ts`]: exported,
        },
      },
      {
        rule: 'domain-no-barrel',
        title: 'something imports a business domain subfolder index',
        files: {
          [`${modulePath}/business/service/a-service.ts`]: "import '../domain/types/index.js';\n",
          [`${modulePath}/business/domain/types/index.ts`]: exported,
        },
      },
      {
        rule: 'B1-modules-only-through-index',
        title: 'a module deep-imports another module',
        files: {
          'modules/y/index.ts': "import '../x/presentation/api/a.js';\n",
          [`${modulePath}/presentation/api/a.ts`]: exported,
        },
      },
      {
        rule: 'W1-composition-root-imports-only-indexes-and-shared',
        title: 'composition-root imports a module repository',
        files: {
          'composition-root.ts': "import './modules/x/infrastructure/repository/y.js';\n",
          [`${modulePath}/infrastructure/repository/y.ts`]: exported,
        },
      },
      {
        rule: 'W2-in-memory-implementations-only-in-composition-root',
        title: 'a module service imports a shared in-memory implementation',
        files: {
          [`${modulePath}/business/service/a-service.ts`]:
            "import '../../../../shared/in-memory-event-bus.js';\n",
          'shared/in-memory-event-bus.ts': exported,
        },
      },
      {
        rule: 'G1-no-circular',
        title: 'two files import each other',
        files: {
          'shared/a.ts': "import './b.js';\nexport const first = 1;\n",
          'shared/b.ts': "import './a.js';\nexport const second = 2;\n",
        },
      },
      {
        rule: 'not-to-unresolvable',
        title: 'a file imports a missing file',
        files: {
          'shared/a.ts': "import './missing.js';\n",
        },
      },
    ])('should fail with $rule when $title', ({ rule, files }) => {
      const result = cruise(files);

      expect(result.passed).toBe(false);
      expect(result.output).toContain(rule);
    });

    it.each([
      {
        title: 'a service test imports its own testing folder',
        files: {
          [`${modulePath}/business/service/a-service.test.ts`]:
            "import '../../testing/fake-b.js';\n",
          [`${modulePath}/testing/fake-b.ts`]: "import '../business/domain/d.js';\n",
          [`${modulePath}/business/domain/d.ts`]: exported,
        },
      },
      {
        title: 'business imports its own domain, errors and the shared error and event bus files',
        files: {
          [`${modulePath}/business/service/a-service.ts`]:
            "import '../domain/d.js';\nimport '../errors/e.js';\nimport '../../../../shared/event-bus.js';\n",
          [`${modulePath}/business/domain/d.ts`]: exported,
          [`${modulePath}/business/errors/e.ts`]: "import '../../../../shared/errors.js';\n",
          'shared/errors.ts': exported,
          'shared/event-bus.ts': exported,
        },
      },
      {
        title: 'business imports a type from shared/clock and the ticket status',
        files: {
          [`${modulePath}/business/service/a-service.ts`]:
            "import type { Clock } from '../../../../shared/clock/clock.js';\nimport type { TicketStatus } from '../../../../shared/ticket-status/ticket-status.js';\nexport type Both = [Clock, TicketStatus];\n",
          'shared/clock/clock.ts': 'export type Clock = object;\n',
          'shared/ticket-status/ticket-status.ts': "export type TicketStatus = 'ready';\n",
        },
      },
      {
        title: 'domain imports the TicketStatus type',
        files: {
          [`${modulePath}/business/domain/d.ts`]:
            "import type { TicketStatus } from '../../../../shared/ticket-status/ticket-status.js';\nexport type D = TicketStatus;\n",
          'shared/ticket-status/ticket-status.ts': "export type TicketStatus = 'ready';\n",
        },
      },
      {
        title: 'the http api imports shared/http',
        files: {
          [`${modulePath}/presentation/api/a.ts`]: "import '../../../../shared/http.js';\n",
          'shared/http.ts': exported,
        },
      },
      {
        title: 'a service test imports another module index',
        files: {
          [`${modulePath}/business/service/a-service.test.ts`]: "import '../../index.js';\n",
          [`${modulePath}/index.ts`]: exported,
        },
      },
      {
        title: 'composition-root imports a module index, shared code and an in-memory bus',
        files: {
          'composition-root.ts':
            "import './modules/x/index.js';\nimport './shared/config.js';\nimport './shared/in-memory-event-bus.js';\n",
          [`${modulePath}/index.ts`]: exported,
          'shared/config.ts': exported,
          'shared/in-memory-event-bus.ts': exported,
        },
      },
      {
        title: 'a module test imports a shared in-memory implementation',
        files: {
          [`${modulePath}/x.module.test.ts`]: "import '../../shared/in-memory-event-bus.js';\n",
          'shared/in-memory-event-bus.ts': exported,
        },
      },
      {
        title: 'a module imports another module through its index',
        files: {
          'modules/y/index.ts': "import '../x/index.js';\n",
          [`${modulePath}/index.ts`]: exported,
        },
      },
    ])('should pass when $title', ({ files }) => {
      expect(cruise(files).passed).toBe(true);
    });

    it('should pass when packages/ui imports a module api dto', () => {
      const result = cruiseAcrossPackages({
        'packages/ui/src/a.ts':
          "import '../../app/src/modules/x/presentation/dto/api/schemas.js';\n",
        'packages/app/src/modules/x/presentation/dto/api/schemas.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('ui-only-api-schemas-from-app', () => {
    it.each([
      {
        title: 'a module index',
        files: {
          'packages/ui/src/main.ts': "import '../../app/src/modules/x/index.js';\n",
          'packages/app/src/modules/x/index.ts': exported,
        },
      },
    ])('should fail when packages/ui imports $title', ({ files }) => {
      const result = cruiseAcrossPackages(files);

      expect(result.passed).toBe(false);
      expect(result.output).toContain('ui-only-api-schemas-from-app');
    });

    it('should pass when packages/ui imports shared/http', () => {
      const result = cruiseAcrossPackages({
        'packages/ui/src/main.ts': "import '../../app/src/shared/http.js';\n",
        'packages/app/src/shared/http.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });
});
