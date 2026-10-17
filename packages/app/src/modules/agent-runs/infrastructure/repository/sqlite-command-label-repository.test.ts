import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SqliteCommandLabelRepository } from './sqlite-command-label-repository.js';
import { migrations } from '../../../../shared/db/migrations.js';
import { openDatabase } from '../../../../shared/db/open-database.js';
import { runMigrations } from '../../../../shared/db/run-migrations.js';

describe('SqliteCommandLabelRepository', () => {
  let homeDirectory: string;
  let database: DatabaseSync;
  let repository: SqliteCommandLabelRepository;

  beforeEach(() => {
    homeDirectory = mkdtempSync(join(tmpdir(), 'aisf-command-labels-'));
    database = openDatabase(join(homeDirectory, 'aisf.db'));
    runMigrations(database, migrations);
    repository = new SqliteCommandLabelRepository(database);
  });

  afterEach(() => {
    database.close();
    rmSync(homeDirectory, { recursive: true, force: true });
  });

  it('should create command_labels with a primary key hash and a non-null label when migrations run', () => {
    const columns = database.prepare('PRAGMA table_info(command_labels)').all();

    expect(columns.map((column) => [column['name'], column['notnull'], column['pk']])).toEqual([
      ['command_hash', 0, 1],
      ['label', 1, 0],
    ]);
  });

  it('should return the stored label when the hash was inserted', async () => {
    await repository.insert('abc', 'Runs the tests.');

    expect(await repository.findByCommandHash('abc')).toBe('Runs the tests.');
  });

  it('should return undefined when the hash is unknown', async () => {
    expect(await repository.findByCommandHash('abc')).toBeUndefined();
  });

  it('should keep the first label when the same hash is inserted twice', async () => {
    await repository.insert('abc', 'First.');

    await expect(repository.insert('abc', 'Second.')).resolves.toBeUndefined();

    expect(await repository.findByCommandHash('abc')).toBe('First.');
  });
});
