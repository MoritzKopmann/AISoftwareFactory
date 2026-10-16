import type { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import type { AgentToolRegistry } from '../../../../shared/agent-tools.js';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import type { Identifiers } from '../../../../shared/identifiers/identifiers.js';
import type { Jobs } from '../../../../shared/jobs.js';
import type { ArtifactsApi } from './artifacts-api.js';

export type ArtifactsModuleDependencies = {
  readonly database: DatabaseSync;
  readonly agentTools: AgentToolRegistry;
  readonly kitDirectory: string;
  readonly events: EventPublisher;
  readonly identifiers: Identifiers;
  readonly clock: Clock;
};

export type ArtifactsModule = {
  readonly routes: Hono;
  /** Keyed `artifacts.<job-name>`. Empty today. */
  readonly jobs: Jobs;
  readonly internal: ArtifactsApi;
};
