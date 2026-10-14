import { Hono } from 'hono';
import { ticketNumberParameterSchema } from '../../../../shared/http.js';
import { TicketNotResettableError } from '../../logic/errors/ticket-not-resettable-error.js';

export type TicketResets = {
  readonly reset: (projectId: string, ticketNumber: number) => Promise<void>;
};

export function createTicketResetRoutes(ticketResets: TicketResets): Hono {
  return new Hono().post('/:owner/:name/tickets/:number/reset', async (context) => {
    const parsedNumber = ticketNumberParameterSchema.safeParse(context.req.param('number'));
    if (!parsedNumber.success) {
      return context.json({ message: parsedNumber.error.issues[0]?.message }, 400);
    }

    try {
      await ticketResets.reset(
        `${context.req.param('owner')}/${context.req.param('name')}`,
        parsedNumber.data,
      );
      return context.body(null, 204);
    } catch (error) {
      if (error instanceof TicketNotResettableError) {
        return context.json({ message: error.message }, 409);
      }
      throw error;
    }
  });
}
