import type { Hono } from 'hono';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventBus } from '../../../../shared/event-bus.js';
import type { Jobs } from '../../../../shared/jobs.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { TicketsApi } from './tickets-api.js';

export type TicketsModuleDependencies = {
  readonly clock: Clock;
  readonly events: EventBus;
  readonly logger: Logger;
  readonly pollIntervalMilliseconds: number;
  readonly snapshotIntervalMilliseconds: number;
};

export type TicketsModule = {
  readonly routes: Hono;
  /** Keyed `tickets.<job-name>`: `watch-repositories` and `stop-watching`. */
  readonly jobs: Jobs;
  readonly internal: TicketsApi;
};
