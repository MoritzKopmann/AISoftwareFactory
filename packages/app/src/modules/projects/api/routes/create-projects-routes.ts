import { Hono } from 'hono';
import { CheckoutNotARepositoryError } from '../../logic/errors/checkout-not-a-repository-error.js';
import { LabelSyncFailedError } from '../../logic/errors/label-sync-failed-error.js';
import { PluginInstallFailedError } from '../../logic/errors/plugin-install-failed-error.js';
import { ProjectAlreadyAddedError } from '../../logic/errors/project-already-added-error.js';
import { RepositoryResolutionFailedError } from '../../logic/errors/repository-resolution-failed-error.js';
import type { AddProjectUseCase } from '../../logic/use-cases/add-project-use-case.js';
import type { ListProjectsUseCase } from '../../logic/use-cases/list-projects-use-case.js';
import { addProjectRequestSchema } from '../schemas/projects-schemas.js';

export function createProjectsRoutes(
  listProjects: ListProjectsUseCase,
  addProject: AddProjectUseCase,
): Hono {
  return new Hono()
    .get('/', async (context) => context.json(await listProjects.execute()))
    .post('/', async (context) => {
      if (context.req.header('content-type') !== 'application/json') {
        return context.json({ message: 'Content-Type must be application/json' }, 415);
      }

      const parsed = addProjectRequestSchema.safeParse(await context.req.json());
      if (!parsed.success) {
        return context.json({ message: parsed.error.message }, 400);
      }

      try {
        const project = await addProject.execute(parsed.data.checkoutPath);
        return context.json(project, 201);
      } catch (error) {
        if (error instanceof ProjectAlreadyAddedError) {
          return context.json({ message: error.message }, 409);
        }
        if (error instanceof CheckoutNotARepositoryError) {
          return context.json({ message: error.message }, 422);
        }
        if (
          error instanceof RepositoryResolutionFailedError ||
          error instanceof LabelSyncFailedError ||
          error instanceof PluginInstallFailedError
        ) {
          return context.json({ message: error.message }, 502);
        }
        throw error;
      }
    });
}
