import { Hono } from 'hono';
import type { SkillsStartupService } from '../../business/service/skills-startup-service.js';
import { toSkillsStatusDto } from '../dto/mapper/skills-status-mapper.js';

/** The module's route table, with full paths. */
export function createSkillsRoutes(startupService: SkillsStartupService): Hono {
  return new Hono().get('/api/skills/status', (context) =>
    context.json(toSkillsStatusDto(startupService.readStatus())),
  );
}
