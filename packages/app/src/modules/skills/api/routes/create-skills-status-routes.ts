import { Hono } from 'hono';
import type { ReadSkillsStatusUseCase } from '../../logic/use-cases/read-skills-status-use-case.js';

export function createSkillsStatusRoutes(readSkillsStatus: ReadSkillsStatusUseCase): Hono {
  return new Hono().get('/status', (context) => context.json(readSkillsStatus.execute()));
}
