import type { Hono } from 'hono';
import type { EventSubscriber } from '../../../../shared/event-bus.js';
import type { Jobs } from '../../../../shared/jobs.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { SchedulerApi } from './scheduler-api.js';

export type SchedulerModuleDependencies = {
  readonly events: EventSubscriber;
  readonly logger: Logger;
};

export type SchedulerModule = {
  readonly routes: Hono;
  /** Empty: the `snapshot.changed` subscription registers in the factory. */
  readonly jobs: Jobs;
  readonly internal: SchedulerApi;
};
