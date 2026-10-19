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
  {
    version: 7,
    name: 'create-artifacts',
    sql: `
      CREATE TABLE artifacts (
        token TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        ticket_number INTEGER NOT NULL,
        artifact_id TEXT NOT NULL,
        title TEXT NOT NULL,
        directory TEXT NOT NULL,
        run_id TEXT NOT NULL,
        version INTEGER NOT NULL,
        published_at TEXT NOT NULL,
        UNIQUE (project_id, ticket_number, artifact_id)
      );
    `,
  },
  {
    version: 8,
    name: 'runs-checkpoint-page',
    sql: `
      ALTER TABLE runs ADD COLUMN checkpoint_page_title TEXT;
      ALTER TABLE runs ADD COLUMN checkpoint_page_url TEXT;
      UPDATE runs
      SET checkpoint_page_title = (
          SELECT artifacts.title FROM artifacts
          WHERE artifacts.project_id = runs.project_id
            AND artifacts.ticket_number = runs.ticket_number
            AND artifacts.artifact_id = runs.checkpoint_artifact_id
        ),
        checkpoint_page_url = (
          SELECT '/a/' || artifacts.token || '/' FROM artifacts
          WHERE artifacts.project_id = runs.project_id
            AND artifacts.ticket_number = runs.ticket_number
            AND artifacts.artifact_id = runs.checkpoint_artifact_id
        )
      WHERE checkpoint_artifact_id IS NOT NULL;
    `,
  },
  {
    version: 9,
    name: 'projects-paused',
    sql: `
      ALTER TABLE projects ADD COLUMN paused INTEGER NOT NULL DEFAULT 0;
    `,
  },
  {
    version: 10,
    name: 'command-labels',
    sql: `
      CREATE TABLE command_labels (
        command_hash TEXT PRIMARY KEY,
        label TEXT NOT NULL
      );
    `,
  },
  {
    version: 11,
    name: 'usage-window',
    sql: `
      CREATE TABLE usage_window (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        five_hour_utilization REAL,
        five_hour_resets_at TEXT,
        seven_day_utilization REAL,
        seven_day_resets_at TEXT,
        observed_at TEXT,
        paused_until TEXT
      );
    `,
  },
  {
    version: 12,
    name: 'runs-held-answer',
    sql: `
      ALTER TABLE runs ADD COLUMN held_answer TEXT;
    `,
  },
];
