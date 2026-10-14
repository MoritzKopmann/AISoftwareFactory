import type { Hono } from 'hono';
import type { EventSubscriber } from '../../shared/event-bus.js';
import type { Jobs } from '../../shared/jobs.js';
import { createLiveRoutes } from './presentation/api/live.routes.js';

type LiveModuleDependencies = {
  readonly events: EventSubscriber;
};

type LiveModule = {
  readonly routes: Hono;
  readonly jobs: Jobs;
  readonly internal: Record<string, never>;
};

export function createLiveModule(dependencies: LiveModuleDependencies): LiveModule {
  return { routes: createLiveRoutes(dependencies.events), jobs: {}, internal: {} };
}
