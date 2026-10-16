import { Hono } from 'hono';
import { ticketNumberParameterSchema } from '../../../../shared/http.js';
import type { ArtifactService } from '../../business/service/artifact-service.js';
import { toTicketArtifactsResponse } from '../dto/mapper/artifact-mapper.js';

export function createTicketArtifactsRoutes(artifactService: ArtifactService): Hono {
  return new Hono().get('/:owner/:name/tickets/:number/artifacts', async (context) => {
    const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
    if (!parsedNumber.success) {
      return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
    }
    const projectId = `${context.req.param('owner')}/${context.req.param('name')}`;
    const artifacts = await artifactService.listForTicket(projectId, parsedNumber.data);
    return context.json(toTicketArtifactsResponse(artifacts));
  });
}
