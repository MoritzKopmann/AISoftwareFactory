import { Hono } from 'hono';
import { createProjectsRoutes, type ProjectsPort } from './api/routes/create-projects-routes.js';
import { createRunRoutes, type RunsPort } from './api/routes/create-run-routes.js';
import { createSkillsStatusRoutes } from './api/routes/create-skills-status-routes.js';
import { createTicketsRoutes, type WatcherPort } from './api/routes/create-tickets-routes.js';
import type { SkillsStatus } from '../skills/index.js';

export type { ProjectsPort } from './api/routes/create-projects-routes.js';
export type { RunsPort } from './api/routes/create-run-routes.js';
export type { WatcherPort } from './api/routes/create-tickets-routes.js';

export type UiModuleDependencies = {
  readonly projects: ProjectsPort;
  readonly watcher: WatcherPort;
  readonly runs: RunsPort;
  readonly skills: {
    readonly status: () => SkillsStatus;
  };
};

export type UiModule = {
  readonly routes: Hono;
};

export function createUiModule(dependencies: UiModuleDependencies): UiModule {
  return {
    routes: new Hono()
      .route('/projects', createProjectsRoutes(dependencies.projects))
      .route('/projects', createTicketsRoutes(dependencies.watcher, dependencies.runs))
      .route('/', createRunRoutes(dependencies.runs))
      .route(
        '/skills',
        createSkillsStatusRoutes(() => dependencies.skills.status()),
      ),
  };
}
