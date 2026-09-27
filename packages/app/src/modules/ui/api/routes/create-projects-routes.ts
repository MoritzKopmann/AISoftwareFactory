import { Hono } from 'hono';
import {
  CheckoutNotARepositoryError,
  GitHubCliError,
  PluginInstallFailedError,
  ProjectAlreadyAddedError,
  type Project,
  type ProjectWithContract,
} from '../../../projects/index.js';
import { addProjectRequestSchema } from '../schemas/projects-schemas.js';

export type ProjectsPort = {
  readonly list: () => Promise<ReadonlyArray<ProjectWithContract>>;
  readonly add: (checkoutPath: string) => Promise<Project>;
};

export function createProjectsRoutes(projects: ProjectsPort): Hono {
  return new Hono()
    .get('/', async (context) => context.json(await projects.list()))
    .post('/', async (context) => {
      if (context.req.header('content-type') !== 'application/json') {
        return context.json({ message: 'Content-Type must be application/json' }, 415);
      }

      const parsed = addProjectRequestSchema.safeParse(await context.req.json());
      if (!parsed.success) {
        return context.json({ message: parsed.error.message }, 400);
      }

      try {
        const project = await projects.add(parsed.data.checkoutPath);
        return context.json(project, 201);
      } catch (error) {
        if (error instanceof ProjectAlreadyAddedError) {
          return context.json({ message: error.message }, 409);
        }
        if (error instanceof CheckoutNotARepositoryError) {
          return context.json({ message: error.message }, 422);
        }
        if (error instanceof GitHubCliError || error instanceof PluginInstallFailedError) {
          return context.json({ message: error.message }, 502);
        }
        throw error;
      }
    });
}
