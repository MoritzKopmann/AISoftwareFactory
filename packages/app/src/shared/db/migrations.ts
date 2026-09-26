import type { Migration } from './run-migrations.js';

export const migrations: ReadonlyArray<Migration> = [{ version: 1, name: 'initial', sql: '' }];
