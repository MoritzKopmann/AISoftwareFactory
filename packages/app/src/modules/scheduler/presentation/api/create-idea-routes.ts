import { Hono } from 'hono';
import { statusForDomainError } from '../../../../shared/http.js';
import { IdeaRunNotStartedError } from '../../business/errors/idea-run-not-started-error.js';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';
import { ideaRequestSchema } from '../dto/api/ideas-schemas.js';
import { toIdeaResponse, toIdeaRunNotStartedResponse } from '../dto/mapper/idea-mapper.js';
import { readJsonBody } from './read-json-body.js';

export function createIdeaRoutes(
  ticketRunService: Pick<TicketRunService, 'startIdeaSession'>,
): Hono {
  return new Hono().post('/:owner/:name/ideas', async (context) => {
    const parsedBody = ideaRequestSchema.safeParse(await readJsonBody(context));
    if (!parsedBody.success) {
      return context.json({ message: parsedBody.error.issues[0]?.message }, 400);
    }

    try {
      const ticketNumber = await ticketRunService.startIdeaSession(
        `${context.req.param('owner')}/${context.req.param('name')}`,
        parsedBody.data.text,
      );
      return context.json(toIdeaResponse(ticketNumber), 201);
    } catch (error) {
      if (error instanceof IdeaRunNotStartedError) {
        return context.json(toIdeaRunNotStartedResponse(error), 409);
      }
      const status = statusForDomainError(error);
      if (status === undefined || !(error instanceof Error)) {
        throw error;
      }
      return context.json({ message: error.message }, status);
    }
  });
}
