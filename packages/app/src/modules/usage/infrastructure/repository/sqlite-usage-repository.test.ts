import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteUsageRepository } from './sqlite-usage-repository.js';
import { migrations } from '../../../../shared/db/migrations.js';
import { openDatabase } from '../../../../shared/db/open-database.js';
import { runMigrations } from '../../../../shared/db/run-migrations.js';
import type { UsageWindow } from '../../business/domain/types/usage-window.js';

const window: UsageWindow = {
  fiveHour: { utilizationPercent: 42, resetsAt: '2026-10-18T15:00:00Z' },
  sevenDay: { utilizationPercent: 10, resetsAt: '2026-10-22T08:00:00Z' },
  observedAt: '2026-10-18T12:00:00Z',
  pausedUntil: '2026-10-18T15:00:00Z',
};

describe('SqliteUsageRepository', () => {
  let homeDirectory: string;
  let databasePath: string;
  let database: DatabaseSync;

  beforeEach(() => {
    homeDirectory = mkdtempSync(join(tmpdir(), 'aisf-usage-'));
    databasePath = join(homeDirectory, 'aisf.db');
    database = openDatabase(databasePath);
    runMigrations(database, migrations);
  });

  afterEach(() => {
    database.close();
    rmSync(homeDirectory, { recursive: true, force: true });
  });

  it('should find nothing when no window is stored', async () => {
    expect(await new SqliteUsageRepository(database).find()).toBeUndefined();
  });

  it('should find the saved window when saved once', async () => {
    const repository = new SqliteUsageRepository(database);

    await repository.save(window);

    expect(await repository.find()).toEqual(window);
  });

  it('should keep one row and the latest values when saved twice', async () => {
    const repository = new SqliteUsageRepository(database);
    await repository.save(window);

    await repository.save({ ...window, fiveHour: null, pausedUntil: null });

    expect(await repository.find()).toEqual({ ...window, fiveHour: null, pausedUntil: null });
    expect(database.prepare('SELECT COUNT(*) AS count FROM usage_window').get()).toEqual({
      count: 1,
    });
  });

  it('should find the same window when a new repository opens the same file', async () => {
    await new SqliteUsageRepository(database).save(window);
    database.close();
    database = openDatabase(databasePath);

    expect(await new SqliteUsageRepository(database).find()).toEqual(window);
  });
});
