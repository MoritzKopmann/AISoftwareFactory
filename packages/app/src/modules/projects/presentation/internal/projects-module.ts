import type { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventBus } from '../../../../shared/event-bus.js';
import type { Jobs } from '../../../../shared/jobs.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { ProjectsApi } from './projects-api.js';

export type ProjectsModuleDependencies = {
  readonly database: DatabaseSync;
  readonly clock: Clock;
  readonly events: EventBus;
  readonly logger: Logger;
};

export type ProjectsModule = {
  readonly routes: Hono;
  /** Keyed `projects.<job-name>`. */
  readonly jobs: Jobs;
  readonly internal: ProjectsApi;
};
