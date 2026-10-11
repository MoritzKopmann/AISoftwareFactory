import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  createTicketResetRoutes,
  type TicketResets,
} from '../../../../../src/modules/tickets/api/routes/create-ticket-reset-routes.js';
import { TicketNotResettableError } from '../../../../../src/modules/tickets/logic/errors/ticket-not-resettable-error.js';

class FakeTicketResets implements TicketResets {
  resetFailure: Error | undefined;
  readonly calls: string[] = [];

  async reset(projectId: string, ticketNumber: number): Promise<void> {
    this.calls.push(`reset ${projectId} #${ticketNumber}`);
    if (this.resetFailure !== undefined) {
      throw this.resetFailure;
    }
  }
}

function createTestApp(ticketResets: TicketResets): Hono {
  return new Hono().route('/projects', createTicketResetRoutes(ticketResets));
}

describe('createTicketResetRoutes', () => {
  describe('POST /projects/:owner/:name/tickets/:number/reset', () => {
    it('should answer 204 with an empty body when the reset succeeds', async () => {
      const ticketResets = new FakeTicketResets();

      const response = await createTestApp(ticketResets).request(
        '/projects/moritz/aisf/tickets/138/reset',
        { method: 'POST' },
      );

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect(ticketResets.calls).toEqual(['reset moritz/aisf #138']);
    });

    it('should answer 409 with the message when the ticket is not resettable', async () => {
      const ticketResets = new FakeTicketResets();
      ticketResets.resetFailure = new TicketNotResettableError('#138 is not stuck or in progress');

      const response = await createTestApp(ticketResets).request(
        '/projects/moritz/aisf/tickets/138/reset',
        { method: 'POST' },
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: '#138 is not stuck or in progress' });
    });

    it('should answer 400 and not reset when the ticket number is bad', async () => {
      const ticketResets = new FakeTicketResets();

      const response = await createTestApp(ticketResets).request(
        '/projects/moritz/aisf/tickets/abc/reset',
        { method: 'POST' },
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        message: 'The ticket number must be a positive integer',
      });
      expect(ticketResets.calls).toEqual([]);
    });
  });
});
