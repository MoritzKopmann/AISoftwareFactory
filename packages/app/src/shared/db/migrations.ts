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
  {
    version: 3,
    name: 'create-runs',
    sql: `
      CREATE TABLE runs (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        ticket_number INTEGER NOT NULL,
        stage TEXT NOT NULL,
        mode TEXT NOT NULL,
        session_id TEXT NOT NULL,
        worktree_path TEXT NOT NULL,
        branch_name TEXT NOT NULL,
        state TEXT NOT NULL,
        ending_kind TEXT,
        ending_reason TEXT,
        escalation_kind TEXT,
        blocker_number INTEGER,
        tool_name TEXT,
        tool_input TEXT,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        settled_at TEXT
      );
      CREATE UNIQUE INDEX runs_one_running_per_project
        ON runs (project_id)
        WHERE state = 'running';
    `,
  },
  {
    version: 4,
    name: 'create-findings',
    sql: `
      CREATE TABLE findings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id TEXT NOT NULL,
        ticket_number INTEGER NOT NULL,
        run_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        location TEXT NOT NULL,
        summary TEXT NOT NULL,
        state TEXT NOT NULL,
        created_ticket_number INTEGER,
        reported_at TEXT NOT NULL,
        resolved_at TEXT
      );
      CREATE INDEX findings_by_project_and_ticket
        ON findings (project_id, ticket_number);
    `,
  },
  {
    version: 5,
    name: 'runs-one-running-per-ticket',
    sql: `
      DROP INDEX runs_one_running_per_project;
      CREATE UNIQUE INDEX runs_one_running_per_ticket
        ON runs (project_id, ticket_number)
        WHERE state = 'running';
    `,
  },
  {
    version: 6,
    name: 'runs-waiting',
    sql: `
      ALTER TABLE runs ADD COLUMN waiting_kind TEXT;
      ALTER TABLE runs ADD COLUMN waiting_request TEXT;
      ALTER TABLE runs ADD COLUMN waiting_since TEXT;
      ALTER TABLE runs ADD COLUMN checkpoint_artifact_id TEXT;
    `,
  },
];
