import { Hono } from 'hono';
import { createProjectsRoutes, type ProjectsPort } from './api/routes/create-projects-routes.js';
import { createSkillsStatusRoutes } from './api/routes/create-skills-status-routes.js';
import type { SkillsStatus } from '../skills/index.js';

export type { ProjectsPort } from './api/routes/create-projects-routes.js';

export type UiModuleDependencies = {
  readonly projects: ProjectsPort;
  readonly skills: {
    readonly status: () => SkillsStatus;
  };
};

export type UiModule = {
  readonly routes: Hono;
};

export function createUiModule(dependencies: UiModuleDependencies): UiModule {
  return {
    routes: new Hono().route('/projects', createProjectsRoutes(dependencies.projects)).route(
      '/skills',
      createSkillsStatusRoutes(() => dependencies.skills.status()),
    ),
  };
}
