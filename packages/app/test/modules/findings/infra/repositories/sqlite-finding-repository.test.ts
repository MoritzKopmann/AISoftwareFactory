import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteFindingRepository } from '../../../../../src/modules/findings/infra/repositories/sqlite-finding-repository.js';
import type { NewFinding } from '../../../../../src/modules/findings/logic/ports/finding-repository.js';
import { migrations } from '../../../../../src/shared/db/migrations.js';
import { openDatabase } from '../../../../../src/shared/db/open-database.js';
import { runMigrations } from '../../../../../src/shared/db/run-migrations.js';

const newFinding: NewFinding = {
  projectId: 'moritz/aisf',
  ticketNumber: 141,
  runId: 'run-1',
  kind: 'bug',
  location: 'src/a.ts:12',
  summary: 'Loop never ends',
  reportedAt: '2026-09-29T10:00:00.000Z',
};

describe('SqliteFindingRepository', () => {
  let homeDirectory: string;
  let database: DatabaseSync;
  let repository: SqliteFindingRepository;

  beforeEach(() => {
    homeDirectory = mkdtempSync(join(tmpdir(), 'aisf-findings-'));
    database = openDatabase(join(homeDirectory, 'aisf.db'));
    runMigrations(database, migrations);
    repository = new SqliteFindingRepository(database);
  });

  afterEach(() => {
    database.close();
    rmSync(homeDirectory, { recursive: true, force: true });
  });

  describe('insert', () => {
    it('should store an open finding that can then be found by id when inserted', async () => {
      const finding = await repository.insert(newFinding);

      expect(finding).toEqual({ ...newFinding, id: 1, state: 'open' });
      expect(await repository.findById(finding.id)).toEqual(finding);
    });

    it('should give each finding its own id when several are inserted', async () => {
      const first = await repository.insert(newFinding);
      const second = await repository.insert(newFinding);

      expect(second.id).toBe(first.id + 1);
    });
  });

  describe('findById', () => {
    it('should return undefined when the finding does not exist', async () => {
      expect(await repository.findById(99)).toBeUndefined();
    });
  });

  describe('list', () => {
    it('should list a project findings oldest first, optionally for one ticket', async () => {
      await repository.insert(newFinding);
      await repository.insert({ ...newFinding, ticketNumber: 142 });
      await repository.insert({ ...newFinding, projectId: 'moritz/other' });

      expect((await repository.list('moritz/aisf')).map(({ id }) => id)).toEqual([1, 2]);
      expect((await repository.list('moritz/aisf', 142)).map(({ id }) => id)).toEqual([2]);
    });
  });

  describe('claimForTicketing', () => {
    it('should claim an open finding once when claimed twice', async () => {
      await repository.insert(newFinding);

      expect(await repository.claimForTicketing(1)).toBe('claimed');
      expect(await repository.claimForTicketing(1)).toBe('not-open');
      expect((await repository.findById(1))?.state).toBe('creating');
    });

    it('should make the finding open again when the claim is released', async () => {
      await repository.insert(newFinding);
      await repository.claimForTicketing(1);

      await repository.releaseClaim(1);

      expect((await repository.findById(1))?.state).toBe('open');
    });
  });

  describe('markTicketed', () => {
    it('should keep the created ticket number and resolution time when marked ticketed', async () => {
      await repository.insert(newFinding);
      await repository.claimForTicketing(1);

      await repository.markTicketed(1, 207, '2026-09-29T11:00:00.000Z');

      expect(await repository.findById(1)).toMatchObject({
        state: 'ticketed',
        createdTicketNumber: 207,
        resolvedAt: '2026-09-29T11:00:00.000Z',
      });
    });
  });

  describe('dismiss', () => {
    it('should keep a dismissed finding stored when it is dismissed', async () => {
      await repository.insert(newFinding);

      expect(await repository.dismiss(1, '2026-09-29T11:00:00.000Z')).toBe('dismissed');

      expect(await repository.findById(1)).toMatchObject({
        state: 'dismissed',
        resolvedAt: '2026-09-29T11:00:00.000Z',
      });
    });

    it('should not dismiss a finding that is not open', async () => {
      await repository.insert(newFinding);
      await repository.claimForTicketing(1);

      expect(await repository.dismiss(1, '2026-09-29T11:00:00.000Z')).toBe('not-open');
    });
  });
});
