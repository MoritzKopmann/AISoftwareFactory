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
});
