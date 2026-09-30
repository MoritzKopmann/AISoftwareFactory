import { Hono } from 'hono';
import { createRunRoutes, type RunsPort } from './api/routes/create-run-routes.js';

export type { RunsPort } from './api/routes/create-run-routes.js';

export type UiModuleDependencies = {
  readonly runs: RunsPort;
};

export type UiModule = {
  readonly routes: Hono;
};

export function createUiModule(dependencies: UiModuleDependencies): UiModule {
  return {
    routes: new Hono().route('/', createRunRoutes(dependencies.runs)),
  };
}
