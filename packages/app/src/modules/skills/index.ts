import type { Hono } from 'hono';
import { createSkillsStatusRoutes } from './api/routes/create-skills-status-routes.js';
import { determineRunsBlocked } from './logic/domain/determine-runs-blocked.js';
import type { RunsBlocked, SkillsStatus } from './logic/domain/skills-status.js';
import {
  StartSkillsUseCase,
  type StartSkillsDependencies,
} from './logic/use-cases/start-skills-use-case.js';

export type { RunsBlocked, SkillsStatus } from './logic/domain/skills-status.js';

export type SkillsModule = {
  readonly start: () => Promise<void>;
  readonly runsBlocked: () => RunsBlocked;
  readonly statusRoutes: Hono;
};

export function createSkillsModule(dependencies: StartSkillsDependencies): SkillsModule {
  const startSkills = new StartSkillsUseCase(dependencies);
  let status: SkillsStatus = { state: 'pending' };

  return {
    start: async () => {
      status = await startSkills.execute();
    },
    runsBlocked: () => determineRunsBlocked(status),
    statusRoutes: createSkillsStatusRoutes(() => status),
  };
}
