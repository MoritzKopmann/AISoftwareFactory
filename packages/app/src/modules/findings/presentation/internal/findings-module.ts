import type { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import type { AgentToolRegistry } from '../../../../shared/agent-tools.js';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import type { Jobs } from '../../../../shared/jobs.js';
import type { FindingsApi } from './findings-api.js';

export type FindingsModuleDependencies = {
  readonly database: DatabaseSync;
  readonly agentTools: AgentToolRegistry;
  readonly clock: Clock;
  readonly events: EventPublisher;
};

export type FindingsModule = {
  readonly routes: Hono;
  /** Keyed `findings.<job-name>`. */
  readonly jobs: Jobs;
  readonly internal: FindingsApi;
};
