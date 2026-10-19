import type { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventBus } from '../../../../shared/event-bus.js';
import type { Jobs } from '../../../../shared/jobs.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { UsageApi } from './usage-api.js';

export type UsageModuleDependencies = {
  readonly database: DatabaseSync;
  readonly clock: Clock;
  readonly events: EventBus;
  readonly logger: Logger;
};

export type UsageModule = {
  readonly routes: Hono;
  /** Keyed `usage.<job-name>`. */
  readonly jobs: Jobs;
  readonly internal: UsageApi;
};
