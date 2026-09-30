import { Hono } from 'hono';
import { createStopRunRoutes, type RunsPort } from './api/routes/create-stop-run-routes.js';

export type { RunsPort } from './api/routes/create-stop-run-routes.js';

export type UiModuleDependencies = {
  readonly runs: RunsPort;
};

export type UiModule = {
  readonly routes: Hono;
};

export function createUiModule(dependencies: UiModuleDependencies): UiModule {
  return {
    routes: new Hono().route('/', createStopRunRoutes(dependencies.runs)),
  };
}
