import { Hono } from 'hono';
import { IdeaRunNotStartedError } from '../../logic/errors/idea-run-not-started-error.js';
import { ProjectNotFoundError } from '../../logic/errors/project-not-found-error.js';
import { RunNotAvailableError } from '../../logic/errors/run-not-available-error.js';
import { ideaRequestSchema } from '../schemas/ideas-schemas.js';

export type IdeaSessions = {
  readonly start: (projectId: string, text: string) => Promise<number>;
};

export function createIdeaRoutes(ideaSessions: IdeaSessions): Hono {
  return new Hono().post('/:owner/:name/ideas', async (context) => {
    const body: unknown = await context.req.json().catch(() => undefined);
    const parsedBody = ideaRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return context.json({ message: parsedBody.error.issues[0]?.message }, 400);
    }

    try {
      const ticketNumber = await ideaSessions.start(
        `${context.req.param('owner')}/${context.req.param('name')}`,
        parsedBody.data.text,
      );
      return context.json({ ticketNumber }, 201);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) {
        return context.json({ message: error.message }, 404);
      }
      if (error instanceof IdeaRunNotStartedError) {
        return context.json({ message: error.message, ticketNumber: error.ticketNumber }, 409);
      }
      if (error instanceof RunNotAvailableError) {
        return context.json({ message: error.message }, 409);
      }
      throw error;
    }
  });
}
