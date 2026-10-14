import { Hono } from 'hono';
import { statusForDomainError, ticketNumberParameterSchema } from '../../../../shared/http.js';
import type { TicketStatusService } from '../../business/service/ticket-status-service.js';

export function createTicketResetRoutes(
  ticketStatusService: Pick<TicketStatusService, 'reset'>,
): Hono {
  return new Hono().post('/:owner/:name/tickets/:number/reset', async (context) => {
    const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
    if (!parsedNumber.success) {
      return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
    }

    try {
      await ticketStatusService.reset(
        `${context.req.param('owner')}/${context.req.param('name')}`,
        parsedNumber.data,
      );
      return context.body(null, 204);
    } catch (error) {
      const status = statusForDomainError(error);
      if (status === undefined || !(error instanceof Error)) {
        throw error;
      }
      return context.json({ message: error.message }, status);
    }
  });
}
