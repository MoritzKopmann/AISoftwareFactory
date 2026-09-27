import { Hono } from 'hono';
import { createSkillsStatusRoutes } from './api/routes/create-skills-status-routes.js';
import type { SkillsStatus } from '../skills/index.js';

export type UiModuleDependencies = {
  readonly skills: {
    readonly status: () => SkillsStatus;
  };
};

export type UiModule = {
  readonly routes: Hono;
};

export function createUiModule(dependencies: UiModuleDependencies): UiModule {
  return {
    routes: new Hono().route(
      '/skills',
      createSkillsStatusRoutes(() => dependencies.skills.status()),
    ),
  };
}
