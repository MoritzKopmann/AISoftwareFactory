import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrations } from '../../../src/shared/db/migrations.js';
import { openDatabase } from '../../../src/shared/db/open-database.js';
import { runMigrations } from '../../../src/shared/db/run-migrations.js';

describe('migrations', () => {
  let database: DatabaseSync;

  beforeEach(() => {
    database = openDatabase(':memory:');
    runMigrations(database, migrations);
  });

  afterEach(() => {
    database.close();
  });

  it('should add the nullable waiting columns to runs when migration 6 runs', () => {
    const columns = database.prepare('PRAGMA table_info(runs)').all() as unknown as ReadonlyArray<{
      name: string;
      notnull: number;
    }>;

    for (const name of [
      'waiting_kind',
      'waiting_request',
      'waiting_since',
      'checkpoint_artifact_id',
    ]) {
      expect(columns.find((column) => column.name === name)).toMatchObject({ notnull: 0 });
    }
  });

  it('should create the artifacts table when migration 7 runs', () => {
    const columns = database
      .prepare('PRAGMA table_info(artifacts)')
      .all() as unknown as ReadonlyArray<{ name: string; pk: number }>;

    expect(columns.map(({ name }) => name)).toEqual([
      'token',
      'project_id',
      'ticket_number',
      'artifact_id',
      'title',
      'directory',
      'run_id',
      'version',
      'published_at',
    ]);
    expect(columns.find(({ name }) => name === 'token')?.pk).toBe(1);
  });

  it('should refuse a second artifact row when the project, ticket and artifact id repeat', () => {
    const insert = database.prepare(
      `INSERT INTO artifacts (token, project_id, ticket_number, artifact_id, title, directory, run_id, version, published_at)
       VALUES (?, 'o/n', 7, 'plan', 't', '/d', 'r1', 1, '2026-10-06T10:00:00.000Z')`,
    );
    insert.run('T');

    expect(() => insert.run('U')).toThrow(/UNIQUE constraint failed/);
  });
});
