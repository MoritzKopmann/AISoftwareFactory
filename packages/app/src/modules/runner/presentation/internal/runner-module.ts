import type { Hono } from 'hono';
import type { DatabaseSync } from 'node:sqlite';
import type { AgentToolRegistry } from '../../../../shared/agent-tools.js';
import type { Clock } from '../../../../shared/clock/clock.js';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import type { Identifiers } from '../../../../shared/identifiers/identifiers.js';
import type { Jobs } from '../../../../shared/jobs.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { RunnerApi } from './runner-api.js';

export type RunnerModuleDependencies = {
  readonly database: DatabaseSync;
  readonly clock: Clock;
  readonly identifiers: Identifiers;
  readonly events: EventPublisher;
  readonly agentTools: AgentToolRegistry;
  readonly logger: Logger;
  readonly claudeExecutablePath: string;
  readonly pluginDirectory: string;
  readonly worktreesDirectory: string;
  readonly liveAnswerWindowMilliseconds: number;
};

export type RunnerModule = {
  readonly routes: Hono;
  /** Keyed `runner.<job-name>`: `recover-interrupted-runs` and `abort-sessions`. */
  readonly jobs: Jobs;
  readonly internal: RunnerApi;
};
