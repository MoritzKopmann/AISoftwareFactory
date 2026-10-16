import { Hono, type Context } from 'hono';
import { statusForDomainError, ticketNumberParameterSchema } from '../../../../shared/http.js';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';
import { toStartedRunResponse, toTicketRunResponse } from '../dto/mapper/run-mapper.js';

function readProjectId(context: Context): string {
  return `${context.req.param('owner')}/${context.req.param('name')}`;
}

export function createRunRoutes(
  ticketRunService: Pick<TicketRunService, 'readTicketRun' | 'start'>,
): Hono {
  return new Hono()
    .get('/:owner/:name/tickets/:number/run', async (context) => {
      const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
      if (!parsedNumber.success) {
        return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
      }

      const ticketRun = await ticketRunService.readTicketRun(
        readProjectId(context),
        parsedNumber.data,
      );
      return context.json(toTicketRunResponse(ticketRun));
    })
    .post('/:owner/:name/tickets/:number/runs', async (context) => {
      const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
      if (!parsedNumber.success) {
        return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
      }

      try {
        const startedRun = await ticketRunService.start(readProjectId(context), parsedNumber.data);
        return context.json(toStartedRunResponse(startedRun), 201);
      } catch (error) {
        const status = statusForDomainError(error);
        if (status === undefined || !(error instanceof Error)) {
          throw error;
        }
        return context.json({ message: error.message }, status);
      }
    });
}
