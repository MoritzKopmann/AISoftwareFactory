import { Hono } from 'hono';
import { createRunRoutes, type RunsPort } from './api/routes/create-run-routes.js';
import { createTicketsRoutes, type WatcherPort } from './api/routes/create-tickets-routes.js';

export type { RunsPort } from './api/routes/create-run-routes.js';
export type { WatcherPort } from './api/routes/create-tickets-routes.js';

export type UiModuleDependencies = {
  readonly watcher: WatcherPort;
  readonly runs: RunsPort;
};

export type UiModule = {
  readonly routes: Hono;
};

export function createUiModule(dependencies: UiModuleDependencies): UiModule {
  return {
    routes: new Hono()
      .route('/projects', createTicketsRoutes(dependencies.watcher, dependencies.runs))
      .route('/', createRunRoutes(dependencies.runs)),
  };
}
