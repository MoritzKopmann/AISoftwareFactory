import { Hono } from 'hono';
import { statusForDomainError } from '../../../../shared/http.js';
import type { ProjectService } from '../../business/service/project-service.js';
import { addProjectRequestSchema } from '../dto/api/projects-schemas.js';
import { toProjectAddedResponse, toProjectResponse } from '../dto/mapper/project-mapper.js';

/** The module's route table, with full paths. */
export function createProjectsRoutes(projectService: ProjectService): Hono {
  return new Hono()
    .get('/api/projects', async (context) =>
      context.json((await projectService.list()).map(toProjectResponse)),
    )
    .post('/api/projects', async (context) => {
      if (context.req.header('content-type') !== 'application/json') {
        return context.json({ message: 'Content-Type must be application/json' }, 415);
      }

      const parsed = addProjectRequestSchema.safeParse(await context.req.json());
      if (!parsed.success) {
        return context.json({ message: parsed.error.message }, 400);
      }

      try {
        const project = await projectService.add(parsed.data.checkoutPath);
        return context.json(toProjectAddedResponse(project), 201);
      } catch (error) {
        const status = statusForDomainError(error);
        if (status === undefined || !(error instanceof Error)) {
          throw error;
        }
        return context.json({ message: error.message }, status);
      }
    });
}
