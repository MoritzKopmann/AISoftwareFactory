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

    it('should throw RunAlreadyActiveError when another run in the project is running', async () => {
      await repository.insert(buildRun());

      await expect(repository.insert(buildRun({ id: 'run-2', ticketNumber: 12 }))).rejects.toThrow(
        RunAlreadyActiveError,
      );
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

      expect(await repository.findActive('moritz/aisf')).toMatchObject({ id: 'run-2' });
    });
  });

  describe('recordEnding', () => {
    const endings: ReadonlyArray<RunEnding> = [
      { kind: 'escalated', escalation: 'spec', reason: 'AC is vague' },
      { kind: 'permission-needed', toolName: 'Bash', toolInput: { command: 'git config x 1' } },
      { kind: 'parked', blockerNumber: 42 },
      { kind: 'finished' },
      { kind: 'stopped' },
      { kind: 'crashed', reason: 'Login expired' },
      { kind: 'usage-limit', reason: 'five_hour limit rejected' },
      { kind: 'app-restarted' },
    ];

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

  describe('findActive', () => {
    it('should return undefined when the project has no running run', async () => {
      expect(await repository.findActive('moritz/aisf')).toBeUndefined();
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
});
