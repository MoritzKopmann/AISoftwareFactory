import { Hono } from 'hono';
import type { SkillsStatus } from '../../../skills/index.js';

export function createSkillsStatusRoutes(getStatus: () => SkillsStatus): Hono {
  return new Hono().get('/status', (context) => context.json(getStatus()));
}
