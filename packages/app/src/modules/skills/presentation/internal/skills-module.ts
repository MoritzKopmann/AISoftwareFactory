import type { Hono } from 'hono';
import type { EventPublisher } from '../../../../shared/event-bus.js';
import type { Jobs } from '../../../../shared/jobs.js';
import type { Logger } from '../../../../shared/logger/create-logger.js';
import type { SkillsApi } from './skills-api.js';

export type SkillsModuleDependencies = {
  readonly events: EventPublisher;
  readonly logger: Logger;
  /** The aisf plugin source, mirrored into `mirrorDirectory` at start-up. */
  readonly pluginDirectory: string;
  readonly mirrorDirectory: string;
  readonly probeDirectory: string;
  readonly environment: Readonly<Record<string, string | undefined>>;
  /** The directory whose `.claude/settings*.json` files are checked for an apiKeyHelper. */
  readonly projectDirectory: string;
};

export type SkillsModule = {
  readonly routes: Hono;
  /** Keyed `skills.<job-name>`. */
  readonly jobs: Jobs;
  readonly internal: SkillsApi;
};
