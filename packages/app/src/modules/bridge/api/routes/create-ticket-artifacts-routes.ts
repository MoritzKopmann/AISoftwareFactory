import { Hono } from 'hono';
import { ticketNumberParameterSchema } from '../../../../shared/http/ticket-number-parameter-schema.js';
import type { ListTicketArtifactsUseCase } from '../../logic/use-cases/list-ticket-artifacts-use-case.js';
import type { TicketArtifactsResponse } from '../schemas/artifacts-schemas.js';

export function createTicketArtifactsRoutes(listTicketArtifacts: ListTicketArtifactsUseCase): Hono {
  return new Hono().get('/:owner/:name/tickets/:number/artifacts', async (context) => {
    const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
    if (!parsedNumber.success) {
      return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
    }
    const projectId = `${context.req.param('owner')}/${context.req.param('name')}`;
    const artifacts = await listTicketArtifacts.execute(projectId, parsedNumber.data);
    const response: TicketArtifactsResponse = {
      artifacts: artifacts.map(({ artifactId, title, token, status }) => ({
        artifactId,
        title,
        url: `/a/${token}/`,
        status,
      })),
    };
    return context.json(response);
  });
}
