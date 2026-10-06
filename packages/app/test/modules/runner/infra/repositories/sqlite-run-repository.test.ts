import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteRunRepository } from '../../../../../src/modules/runner/infra/repositories/sqlite-run-repository.js';
import type { RunEnding } from '../../../../../src/modules/runner/logic/domain/types/run-ending.js';
import { RunAlreadyActiveError } from '../../../../../src/modules/runner/logic/errors/run-already-active-error.js';
import { migrations } from '../../../../../src/shared/db/migrations.js';
import { openDatabase } from '../../../../../src/shared/db/open-database.js';
import { runMigrations } from '../../../../../src/shared/db/run-migrations.js';
import { buildRun } from '../../fakes/fake-runner-ports.js';

describe('SqliteRunRepository', () => {
  let homeDirectory: string;
  let database: DatabaseSync;
  let repository: SqliteRunRepository;

  beforeEach(() => {
    homeDirectory = mkdtempSync(join(tmpdir(), 'aisf-runs-'));
    database = openDatabase(join(homeDirectory, 'aisf.db'));
    runMigrations(database, migrations);
    repository = new SqliteRunRepository(database);
  });

  afterEach(() => {
    database.close();
    rmSync(homeDirectory, { recursive: true, force: true });
  });

  describe('insert', () => {
    it('should save a run that can then be found by id', async () => {
      const run = buildRun();

      await repository.insert(run);

      expect(await repository.findById('run-1')).toEqual(run);
    });

    it('should throw RunAlreadyActiveError when the ticket already has a running run', async () => {
      await repository.insert(buildRun());

      await expect(repository.insert(buildRun({ id: 'run-2' }))).rejects.toThrow(
        RunAlreadyActiveError,
      );
    });

    it('should accept a running run when another ticket in the project is running', async () => {
      await repository.insert(buildRun());

      await repository.insert(buildRun({ id: 'run-2', ticketNumber: 12 }));

      expect(await repository.findById('run-2')).toBeDefined();
    });

    it('should accept a running run when another project has one running', async () => {
      await repository.insert(buildRun());

      await repository.insert(buildRun({ id: 'run-2', projectId: 'moritz/other' }));

      expect(await repository.findById('run-2')).toBeDefined();
    });

    it('should accept a running run when the project has only ended runs', async () => {
      await repository.insert(buildRun());
      await repository.recordEnding('run-1', { kind: 'finished' }, '2026-09-29T11:00:00.000Z');

      await repository.insert(buildRun({ id: 'run-2', ticketNumber: 12 }));

      expect(await repository.listActive('moritz/aisf')).toMatchObject([{ id: 'run-2' }]);
    });
  });

  describe('recordEnding', () => {
    const samples: { readonly [Kind in RunEnding['kind']]: Extract<RunEnding, { kind: Kind }> } = {
      escalated: { kind: 'escalated', escalation: 'spec', reason: 'AC is vague' },
      'permission-needed': {
        kind: 'permission-needed',
        toolName: 'Bash',
        toolInput: { command: 'git config x 1' },
      },
      parked: { kind: 'parked', blockerNumber: 42 },
      checkpoint: { kind: 'checkpoint', request: 'Check the page' },
      finished: { kind: 'finished' },
      stopped: { kind: 'stopped' },
      crashed: { kind: 'crashed', reason: 'Login expired' },
      'usage-limit': { kind: 'usage-limit', reason: 'five_hour limit rejected' },
      'app-restarted': { kind: 'app-restarted' },
    };
    const endings: ReadonlyArray<RunEnding> = Object.values(samples);

    it.each(endings)('should store a $kind ending that reads back the same', async (ending) => {
      await repository.insert(buildRun());

      const outcome = await repository.recordEnding('run-1', ending, '2026-09-29T11:00:00.000Z');

      expect(outcome).toBe('recorded');
      expect(await repository.findById('run-1')).toEqual({
        ...buildRun(),
        state: 'ended',
        ending,
        endedAt: '2026-09-29T11:00:00.000Z',
      });
    });

    it('should keep the first ending and report already-ended when a second one arrives', async () => {
      await repository.insert(buildRun());
      await repository.recordEnding('run-1', { kind: 'parked', blockerNumber: 42 }, 'first');

      const outcome = await repository.recordEnding('run-1', { kind: 'stopped' }, 'second');

      expect(outcome).toBe('already-ended');
      expect((await repository.findById('run-1'))?.ending).toEqual({
        kind: 'parked',
        blockerNumber: 42,
      });
    });
  });

  describe('listActive', () => {
    it('should return nothing when the project has no running run', async () => {
      expect(await repository.listActive('moritz/aisf')).toEqual([]);
    });

    it('should return every running run of the project, oldest first', async () => {
      await repository.insert(
        buildRun({ id: 'run-2', ticketNumber: 12, startedAt: '2026-09-29T10:00:00.000Z' }),
      );
      await repository.insert(buildRun({ startedAt: '2026-09-29T09:00:00.000Z' }));
      await repository.insert(buildRun({ id: 'run-3', projectId: 'moritz/other' }));

      expect(await repository.listActive('moritz/aisf')).toMatchObject([
        { id: 'run-1' },
        { id: 'run-2' },
      ]);
    });
  });

  describe('findLatest', () => {
    it('should return the most recently started run of the ticket when it has several', async () => {
      await repository.insert(buildRun({ startedAt: '2026-09-29T09:00:00.000Z' }));
      await repository.recordEnding('run-1', { kind: 'stopped' }, '2026-09-29T09:30:00.000Z');
      await repository.insert(buildRun({ id: 'run-2', startedAt: '2026-09-29T10:00:00.000Z' }));
      await repository.insert(
        buildRun({ id: 'run-3', ticketNumber: 12, projectId: 'moritz/other' }),
      );

      expect(await repository.findLatest('moritz/aisf', 137)).toMatchObject({ id: 'run-2' });
    });

    it('should return undefined when the ticket has no run', async () => {
      expect(await repository.findLatest('moritz/aisf', 137)).toBeUndefined();
    });
  });

  describe('listByState', () => {
    it('should return only the runs in that state', async () => {
      await repository.insert(buildRun());
      await repository.insert(buildRun({ id: 'run-2', projectId: 'moritz/other' }));
      await repository.recordEnding('run-2', { kind: 'finished' }, 'ended-at');

      const endedRuns = await repository.listByState('ended');

      expect(endedRuns.map((run) => run.id)).toEqual(['run-2']);
    });
  });

  describe('markSettled', () => {
    it('should settle an ended run', async () => {
      await repository.insert(buildRun());
      await repository.recordEnding('run-1', { kind: 'finished' }, 'ended-at');

      await repository.markSettled('run-1', '2026-09-29T12:00:00.000Z');

      expect((await repository.findById('run-1'))?.state).toBe('settled');
    });

    it('should leave a running run running when it is marked settled', async () => {
      await repository.insert(buildRun());

      await repository.markSettled('run-1', '2026-09-29T12:00:00.000Z');

      expect((await repository.findById('run-1'))?.state).toBe('running');
    });
  });

  describe('waiting', () => {
    const since = '2026-09-29T10:05:00.000Z';
    const wait = { kind: 'checkpoint', request: 'Check the page' } as const;

    it('should store the wait and return it on the run when the run has none', async () => {
      await repository.insert(buildRun());

      const outcome = await repository.recordWait('run-1', wait, since);

      expect(outcome).toBe('recorded');
      expect(await repository.findById('run-1')).toEqual(
        buildRun({ waitingFor: wait, waitingSince: since }),
      );
    });

    it('should keep the artifactId on the wait when the wait has one', async () => {
      await repository.insert(buildRun());

      await repository.recordWait('run-1', { ...wait, artifactId: 'confirm-plan' }, since);

      expect((await repository.findById('run-1'))?.waitingFor).toEqual({
        ...wait,
        artifactId: 'confirm-plan',
      });
    });

    it('should refuse and keep the first wait when the run already waits', async () => {
      await repository.insert(buildRun());
      await repository.recordWait('run-1', wait, since);

      const outcome = await repository.recordWait('run-1', { ...wait, request: 'Other' }, since);

      expect(outcome).toBe('refused');
      expect((await repository.findById('run-1'))?.waitingFor?.request).toBe('Check the page');
    });

    it('should refuse when the run has ended', async () => {
      await repository.insert(buildRun());
      await repository.recordEnding('run-1', { kind: 'finished' }, since);

      expect(await repository.recordWait('run-1', wait, since)).toBe('refused');
    });

    it('should clear the wait and keep the run running when clearWait runs', async () => {
      await repository.insert(buildRun());
      await repository.recordWait('run-1', { ...wait, artifactId: 'confirm-plan' }, since);

      await repository.clearWait('run-1');

      expect(await repository.findById('run-1')).toEqual(buildRun());
    });

    it('should clear the wait and keep the artifactId on a checkpoint ending when the ending carries it', async () => {
      await repository.insert(buildRun());
      await repository.recordWait('run-1', { ...wait, artifactId: 'confirm-plan' }, since);

      await repository.recordEnding(
        'run-1',
        { kind: 'checkpoint', request: 'Check the page', artifactId: 'confirm-plan' },
        since,
      );

      const run = await repository.findById('run-1');
      expect(run?.ending).toEqual({
        kind: 'checkpoint',
        request: 'Check the page',
        artifactId: 'confirm-plan',
      });
      expect(run).not.toHaveProperty('waitingFor');
      expect(run).not.toHaveProperty('waitingSince');
    });

    it('should clear the artifactId when a non-checkpoint ending is recorded', async () => {
      await repository.insert(buildRun());
      await repository.recordWait('run-1', { ...wait, artifactId: 'confirm-plan' }, since);

      await repository.recordEnding('run-1', { kind: 'stopped' }, since);

      const row = database
        .prepare('SELECT checkpoint_artifact_id FROM runs WHERE id = ?')
        .get('run-1');
      expect(row).toEqual({ checkpoint_artifact_id: null });
    });

    it('should return a checkpoint ending without artifactId when none was stored', async () => {
      await repository.insert(buildRun());

      await repository.recordEnding('run-1', { kind: 'checkpoint', request: 'Check' }, since);

      expect((await repository.findById('run-1'))?.ending).toEqual({
        kind: 'checkpoint',
        request: 'Check',
      });
    });
  });
});
