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
        rule: 'main-only-through-index-and-infra',
        title: 'composition-root imports module logic',
        files: {
          'composition-root.ts': "import './modules/x/business/service/a-service.js';\n",
          [`${modulePath}/business/service/a-service.ts`]: exported,
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
        title: 'composition-root imports a module index and its infrastructure',
        files: {
          'composition-root.ts':
            "import './modules/x/index.js';\nimport './modules/x/infrastructure/repository/b.js';\n",
          [`${modulePath}/index.ts`]: exported,
          [`${modulePath}/infrastructure/repository/b.ts`]: exported,
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

  describe('modules-only-through-index', () => {
    it('should fail when a module deep-imports another module', () => {
      const result = cruise({
        'modules/scheduler/index.ts': "import '../tickets/logic/domain/types/snapshot.js';\n",
        'modules/tickets/index.ts': exported,
        'modules/tickets/logic/domain/types/snapshot.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('modules-only-through-index');
    });

    it('should pass when a module imports another module through its index', () => {
      const result = cruise({
        'modules/scheduler/index.ts': "import '../tickets/index.js';\n",
        'modules/tickets/index.ts': exported,
      });

      expect(result.passed).toBe(true);
    });

    it('should pass when a module imports its own layers', () => {
      const result = cruise({
        'modules/tickets/index.ts': "import './api/routes/snapshots.js';\n",
        'modules/tickets/api/routes/snapshots.ts':
          "import '../../logic/domain/types/snapshot.js';\n",
        'modules/tickets/logic/domain/types/snapshot.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('outside-only-through-index', () => {
    it('should fail when shared code deep-imports a module', () => {
      const result = cruise({
        'shared/helper.ts': "import '../modules/tickets/logic/domain/types/snapshot.js';\n",
        'modules/tickets/index.ts': exported,
        'modules/tickets/logic/domain/types/snapshot.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('outside-only-through-index');
    });
  });

  describe('logic-no-infra-or-api', () => {
    it('should fail when logic imports infra', () => {
      const result = cruise({
        'modules/tickets/logic/use-cases/poll.ts': "import '../../infra/repositories/store.js';\n",
        'modules/tickets/infra/repositories/store.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('logic-no-infra-or-api');
    });

    it('should fail when logic imports api', () => {
      const result = cruise({
        'modules/tickets/logic/use-cases/poll.ts': "import '../../api/routes/snapshots.js';\n",
        'modules/tickets/api/routes/snapshots.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('logic-no-infra-or-api');
    });

    it('should pass when infra imports logic', () => {
      const result = cruise({
        'modules/tickets/infra/repositories/store.ts': "import '../../logic/ports/store.js';\n",
        'modules/tickets/logic/ports/store.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('logic-no-other-module', () => {
    it('should fail when logic deep-imports another module', () => {
      const result = cruise({
        'modules/scheduler/logic/use-cases/start.ts':
          "import '../../../tickets/logic/domain/types/snapshot.js';\n",
        'modules/tickets/index.ts': exported,
        'modules/tickets/logic/domain/types/snapshot.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('logic-no-other-module');
    });

    it('should fail when logic imports another module through its index', () => {
      const result = cruise({
        'modules/scheduler/logic/use-cases/start.ts': "import '../../../tickets/index.js';\n",
        'modules/tickets/index.ts': exported,
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
        'packages/ui/src/main.ts': "import '../../app/src/modules/tickets/index.js';\n",
        'packages/app/src/modules/tickets/index.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('ui-only-api-schemas-from-app');
    });

    it('should fail when packages/ui imports a route file of a module', () => {
      const result = cruiseAcrossPackages({
        'packages/ui/src/main.ts':
          "import '../../app/src/modules/tickets/api/routes/create-snapshot-routes.js';\n",
        'packages/app/src/modules/tickets/api/routes/create-snapshot-routes.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('ui-only-api-schemas-from-app');
    });

    it('should fail when packages/ui imports a use case of a module', () => {
      const result = cruiseAcrossPackages({
        'packages/ui/src/main.ts':
          "import '../../app/src/modules/tickets/logic/use-cases/poll-use-case.js';\n",
        'packages/app/src/modules/tickets/logic/use-cases/poll-use-case.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('ui-only-api-schemas-from-app');
    });

    it('should pass when packages/ui imports an api schema from packages/app', () => {
      const result = cruiseAcrossPackages({
        'packages/ui/src/main.ts':
          "import '../../app/src/modules/tickets/api/schemas/projects-schemas.js';\n",
        'packages/app/src/modules/tickets/api/schemas/projects-schemas.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('infra-only-from-main', () => {
    it('should fail when an api adapter imports infra', () => {
      const result = cruise({
        'modules/tickets/api/routes/snapshots.ts': "import '../../infra/repositories/store.js';\n",
        'modules/tickets/infra/repositories/store.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('infra-only-from-main');
    });

    it('should fail when shared code imports infra', () => {
      const result = cruise({
        'shared/helper.ts': "import '../modules/tickets/infra/repositories/store.js';\n",
        'modules/tickets/infra/repositories/store.ts': exported,
      });

      expect(result.passed).toBe(false);
    });

    it('should pass when main imports infra', () => {
      const result = cruise({
        'main.ts': "import './modules/tickets/infra/repositories/store.js';\n",
        'modules/tickets/infra/repositories/store.ts': exported,
      });

      expect(result.passed).toBe(true);
    });

    it('should fail when main imports module logic', () => {
      const result = cruise({
        'main.ts': "import './modules/tickets/logic/domain/types/snapshot.js';\n",
        'modules/tickets/logic/domain/types/snapshot.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('main-only-through-index-and-infra');
    });
  });

  describe('domain-only-domain', () => {
    it('should fail when domain imports ports', () => {
      const result = cruise({
        'modules/tickets/logic/domain/functions/diff.ts': "import '../../ports/store.js';\n",
        'modules/tickets/logic/ports/store.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('domain-only-domain');
    });

    it('should fail when domain imports shared', () => {
      const result = cruise({
        'modules/tickets/logic/domain/types/snapshot.ts':
          "import type { Clock } from '../../../../../shared/clock.js';\nexport type Snapshot = Clock;\n",
        'shared/clock.ts': 'export type Clock = number;\n',
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('domain-only-domain');
    });

    it('should pass when domain imports the shared ticket status', () => {
      const result = cruise({
        'modules/tickets/logic/domain/functions/arrange.ts':
          "import { ticketStatusOrder } from '../../../../../shared/ticket-status/ticket-status-order.js';\nexport const arranged = ticketStatusOrder;\n",
        'shared/ticket-status/ticket-status-order.ts': 'export const ticketStatusOrder = [];\n',
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('domain-types-only-types', () => {
    it('should fail when a domain type imports a constant', () => {
      const result = cruise({
        'modules/tickets/logic/domain/types/snapshot.ts': "import '../constants/labels.js';\n",
        'modules/tickets/logic/domain/constants/labels.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('domain-types-only-types');
    });

    it('should pass when a domain type imports another type', () => {
      const result = cruise({
        'modules/tickets/logic/domain/types/snapshot.ts': "import './ticket.js';\n",
        'modules/tickets/logic/domain/types/ticket.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('domain-constants-only-types', () => {
    it('should fail when a domain constant imports a function', () => {
      const result = cruise({
        'modules/tickets/logic/domain/constants/labels.ts': "import '../functions/diff.js';\n",
        'modules/tickets/logic/domain/functions/diff.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('domain-constants-only-types');
    });

    it('should pass when a domain constant imports a type', () => {
      const result = cruise({
        'modules/tickets/logic/domain/constants/labels.ts': "import '../types/label.js';\n",
        'modules/tickets/logic/domain/types/label.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('domain functions', () => {
    it('should fail when a domain function imports a use case', () => {
      const result = cruise({
        'modules/tickets/logic/domain/functions/diff.ts': "import '../../use-cases/poll.js';\n",
        'modules/tickets/logic/use-cases/poll.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('domain-only-domain');
    });

    it('should pass when a domain function imports a constant', () => {
      const result = cruise({
        'modules/tickets/logic/domain/functions/diff.ts': "import '../constants/labels.js';\n",
        'modules/tickets/logic/domain/constants/labels.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('domain-no-barrel', () => {
    it('should fail when something imports a domain subfolder index', () => {
      const result = cruise({
        'modules/tickets/logic/use-cases/poll.ts': "import '../domain/types/index.js';\n",
        'modules/tickets/logic/domain/types/index.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('domain-no-barrel');
    });
  });

  describe('logic-shared-types-only', () => {
    it('should fail when logic imports a value from shared', () => {
      const result = cruise({
        'modules/tickets/logic/use-cases/poll.ts': "import '../../../../shared/clock.js';\n",
        'shared/clock.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('logic-shared-types-only');
    });

    it('should pass when logic imports a value from the shared ticket status', () => {
      const result = cruise({
        'modules/tickets/logic/use-cases/poll.ts':
          "import '../../../../shared/ticket-status/derive-ticket-status.js';\n",
        'shared/ticket-status/derive-ticket-status.ts': exported,
      });

      expect(result.passed).toBe(true);
    });

    it('should pass when logic imports a type from shared', () => {
      const result = cruise({
        'modules/tickets/logic/use-cases/poll.ts':
          "import type { Clock } from '../../../../shared/clock.js';\nexport type Poll = Clock;\n",
        'shared/clock.ts': 'export type Clock = number;\n',
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('use-cases-only-domain-ports-errors', () => {
    it('should fail when a use case imports another use case', () => {
      const result = cruise({
        'modules/tickets/logic/use-cases/poll.ts': "import './refresh.js';\n",
        'modules/tickets/logic/use-cases/refresh.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('use-cases-only-domain-ports-errors');
    });

    it('should pass when a use case imports domain, ports and errors', () => {
      const result = cruise({
        'modules/tickets/logic/use-cases/poll.ts':
          "import '../domain/types/snapshot.js';\nimport '../ports/store.js';\nimport '../errors/missing-error.js';\n",
        'modules/tickets/logic/domain/types/snapshot.ts': exported,
        'modules/tickets/logic/ports/store.ts': exported,
        'modules/tickets/logic/errors/missing-error.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('infra-logic-only-ports-domain-errors', () => {
    it('should fail when infra imports a use case', () => {
      const result = cruise({
        'modules/tickets/infra/repositories/store.ts': "import '../../logic/use-cases/poll.js';\n",
        'modules/tickets/logic/use-cases/poll.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('infra-logic-only-ports-domain-errors');
    });

    it('should pass when infra imports ports, domain and errors', () => {
      const result = cruise({
        'modules/tickets/infra/repositories/store.ts':
          "import '../../logic/ports/store.js';\nimport '../../logic/domain/types/snapshot.js';\nimport '../../logic/errors/missing-error.js';\n",
        'modules/tickets/logic/ports/store.ts': exported,
        'modules/tickets/logic/domain/types/snapshot.ts': exported,
        'modules/tickets/logic/errors/missing-error.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });

  describe('api-logic-only-use-cases-domain-errors', () => {
    it('should fail when an api adapter imports a port', () => {
      const result = cruise({
        'modules/tickets/api/routes/snapshots.ts': "import '../../logic/ports/store.js';\n",
        'modules/tickets/logic/ports/store.ts': exported,
      });

      expect(result.passed).toBe(false);
      expect(result.output).toContain('api-logic-only-use-cases-domain-errors');
    });

    it('should pass when an api adapter imports a use case, a domain type and an error', () => {
      const result = cruise({
        'modules/tickets/api/routes/snapshots.ts':
          "import '../../logic/use-cases/poll.js';\nimport '../../logic/domain/types/snapshot.js';\nimport '../../logic/errors/missing-error.js';\n",
        'modules/tickets/logic/use-cases/poll.ts': exported,
        'modules/tickets/logic/domain/types/snapshot.ts': exported,
        'modules/tickets/logic/errors/missing-error.ts': exported,
      });

      expect(result.passed).toBe(true);
    });
  });
});
