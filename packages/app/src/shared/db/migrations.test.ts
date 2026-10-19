import type { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migrations } from './migrations.js';
import { openDatabase } from './open-database.js';
import { runMigrations } from './run-migrations.js';

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

  it('should backfill the page of a waiting checkpoint when migration 8 runs on an older database', () => {
    const older = openDatabase(':memory:');
    runMigrations(
      older,
      migrations.filter(({ version }) => version < 8),
    );
    older
      .prepare(
        `INSERT INTO runs (id, project_id, ticket_number, stage, mode, session_id, worktree_path, branch_name, state, started_at, waiting_kind, waiting_request, waiting_since, checkpoint_artifact_id)
         VALUES ('r1', 'o/n', 7, 'plan', 'afk', 's', '/w', '', 'running', '2026-10-06T10:00:00.000Z', 'checkpoint', 'Open it', '2026-10-06T10:01:00.000Z', 'plan-7')`,
      )
      .run();
    older
      .prepare(
        `INSERT INTO artifacts (token, project_id, ticket_number, artifact_id, title, directory, run_id, version, published_at)
         VALUES ('abc', 'o/n', 7, 'plan-7', 'Round 1', '/d', 'r1', 1, '2026-10-06T10:00:30.000Z')`,
      )
      .run();

    runMigrations(older, migrations);

    expect(
      older.prepare('SELECT checkpoint_page_title, checkpoint_page_url FROM runs').get(),
    ).toEqual({ checkpoint_page_title: 'Round 1', checkpoint_page_url: '/a/abc/' });
    older.close();
  });

  it('should add the nullable checkpoint page columns to runs when migration 8 runs', () => {
    const columns = database.prepare('PRAGMA table_info(runs)').all() as unknown as ReadonlyArray<{
      name: string;
      notnull: number;
    }>;

    for (const name of ['checkpoint_page_title', 'checkpoint_page_url']) {
      expect(columns.find((column) => column.name === name)).toMatchObject({ notnull: 0 });
    }
  });

  it('should add a paused column that reads false for an existing project when migration 9 runs', () => {
    const older = openDatabase(':memory:');
    runMigrations(
      older,
      migrations.filter(({ version }) => version <= 8),
    );
    older
      .prepare(
        `INSERT INTO projects (id, owner, name, checkout_path, added_at) VALUES ('o/n', 'o', 'n', '/c', '2026-10-06T10:00:00.000Z')`,
      )
      .run();

    runMigrations(older, migrations);

    expect(older.prepare('SELECT paused FROM projects WHERE id = ?').get('o/n')).toEqual({
      paused: 0,
    });
    older.close();
  });

  it('should create the usage_window table when migration 11 runs', () => {
    const columns = database
      .prepare('PRAGMA table_info(usage_window)')
      .all() as unknown as ReadonlyArray<{ name: string }>;

    expect(columns.map(({ name }) => name)).toEqual([
      'id',
      'five_hour_utilization',
      'five_hour_resets_at',
      'seven_day_utilization',
      'seven_day_resets_at',
      'observed_at',
      'paused_until',
    ]);
  });

  it('should add a nullable held_answer column that is null for existing runs when migration 12 runs', () => {
    const older = openDatabase(':memory:');
    runMigrations(
      older,
      migrations.filter(({ version }) => version <= 11),
    );
    older
      .prepare(
        `INSERT INTO runs (id, project_id, ticket_number, stage, mode, session_id, worktree_path, branch_name, state, started_at) VALUES ('r1', 'o/n', 1, 'implement', 'afk', 's', '/w', 'b', 'running', '2026-10-06T10:00:00.000Z')`,
      )
      .run();

    runMigrations(older, migrations);

    expect(older.prepare('SELECT held_answer FROM runs WHERE id = ?').get('r1')).toEqual({
      held_answer: null,
    });
    older.close();
  });
});
