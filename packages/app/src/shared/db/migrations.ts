import type { Migration } from './run-migrations.js';

export const migrations: ReadonlyArray<Migration> = [
  { version: 1, name: 'initial', sql: '' },
  {
    version: 2,
    name: 'create-projects',
    sql: `
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        owner TEXT NOT NULL,
        name TEXT NOT NULL,
        checkout_path TEXT NOT NULL,
        added_at TEXT NOT NULL
      )
    `,
  },
];
