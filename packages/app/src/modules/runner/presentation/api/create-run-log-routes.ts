import { Hono } from 'hono';
import { ticketNumberParameterSchema } from '../../../../shared/http.js';
import type { RunQueryService } from '../../business/service/run-query-service.js';
import { toRunLogResponse } from '../dto/mapper/run-log-mapper.js';

export function createRunLogRoutes(runQueryService: RunQueryService): Hono {
  return new Hono().get('/api/projects/:owner/:name/tickets/:number/run-log', async (context) => {
    const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
    if (!parsedNumber.success) {
      return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
    }

    const projectId = `${context.req.param('owner')}/${context.req.param('name')}`;
    return context.json(
      toRunLogResponse(await runQueryService.readTicketLog(projectId, parsedNumber.data)),
    );
  });
}
