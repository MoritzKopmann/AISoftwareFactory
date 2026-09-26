import type { DatabaseSync } from 'node:sqlite';

export type Migration = {
  readonly version: number;
  readonly name: string;
  readonly sql: string;
};

export function runMigrations(database: DatabaseSync, migrations: ReadonlyArray<Migration>): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);

  const appliedVersions = new Set(
    database
      .prepare(
        `
        SELECT version
        FROM schema_migrations
      `,
      )
      .all()
      .map((row) => Number(row['version'])),
  );
  const recordMigration = database.prepare(`
    INSERT INTO schema_migrations (version, name)
    VALUES (?, ?)
  `);

  const pendingMigrations = migrations
    .filter((migration) => !appliedVersions.has(migration.version))
    .toSorted((first, second) => first.version - second.version);

  for (const migration of pendingMigrations) {
    database.exec('BEGIN');
    try {
      database.exec(migration.sql);
      recordMigration.run(migration.version, migration.name);
      database.exec('COMMIT');
    } catch (error) {
      database.exec('ROLLBACK');
      throw error;
    }
  }
}
