import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DatabaseSync } from 'node:sqlite';
import { openDatabase } from '../../../src/shared/db/open-database.js';
import { runMigrations, type Migration } from '../../../src/shared/db/run-migrations.js';
import { migrations } from '../../../src/shared/db/migrations.js';

describe('runMigrations', () => {
  let homeDirectory: string;
  let database: DatabaseSync;

  beforeEach(() => {
    homeDirectory = mkdtempSync(join(tmpdir(), 'aisf-migrations-'));
    database = openDatabase(join(homeDirectory, 'aisf.db'));
  });

  afterEach(() => {
    database.close();
    rmSync(homeDirectory, { recursive: true, force: true });
  });

  const createTable = (version: number, table: string): Migration => ({
    version,
    name: `create-${table}`,
    sql: `CREATE TABLE ${table} (id INTEGER PRIMARY KEY)`,
  });

  const appliedVersions = (): number[] =>
    database
      .prepare(
        `
        SELECT version
        FROM schema_migrations
        ORDER BY version
      `,
      )
      .all()
      .map((row) => Number(row['version']));

  const tableNames = (): string[] =>
    database
      .prepare(
        `
        SELECT name
        FROM sqlite_master
        WHERE type = 'table'
        ORDER BY name
      `,
      )
      .all()
      .map((row) => String(row['name']));

  it('should apply every migration when the database is new', () => {
    runMigrations(database, [createTable(1, 'first'), createTable(2, 'second')]);

    expect(appliedVersions()).toEqual([1, 2]);
    expect(tableNames()).toEqual(expect.arrayContaining(['first', 'second']));
  });

  it('should apply migrations in version order when they are listed out of order', () => {
    runMigrations(database, [createTable(2, 'second'), createTable(1, 'first')]);

    expect(appliedVersions()).toEqual([1, 2]);
  });

  it('should apply only the new migrations when run again with more', () => {
    runMigrations(database, [createTable(1, 'first')]);

    runMigrations(database, [createTable(1, 'first'), createTable(2, 'second')]);

    expect(appliedVersions()).toEqual([1, 2]);
  });

  it('should not run an applied migration again when run twice', () => {
    const migration = createTable(1, 'first');
    runMigrations(database, [migration]);

    expect(() => runMigrations(database, [migration])).not.toThrow();
  });

  it('should roll back and record nothing when a migration fails', () => {
    const failing: Migration = { version: 2, name: 'broken', sql: 'CREATE TABLE half (' };

    expect(() => runMigrations(database, [createTable(1, 'first'), failing])).toThrow();

    expect(appliedVersions()).toEqual([1]);
    expect(tableNames()).not.toContain('half');
  });

  it('should apply the checked-in migrations without error when the database is new', () => {
    runMigrations(database, migrations);

    expect(appliedVersions()).toEqual(migrations.map((migration) => migration.version));
  });
});
