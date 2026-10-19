import type { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { Jobs } from '../../../../shared/jobs.js';

export type UsageModuleDependencies = {
  readonly database: DatabaseSync;
  readonly clock: Clock;
};

export type UsageModule = {
  readonly routes: Hono;
  /** Keyed `usage.<job-name>`. */
  readonly jobs: Jobs;
  readonly internal: Record<string, never>;
};
