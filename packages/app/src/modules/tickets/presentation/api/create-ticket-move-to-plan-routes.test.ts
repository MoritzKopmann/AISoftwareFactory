import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { createTicketMoveToPlanRoutes } from './create-ticket-move-to-plan-routes.js';
import type { TicketStatusService } from '../../business/service/ticket-status-service.js';
import { TicketNotMovableError } from '../../business/errors/ticket-not-movable-error.js';

class FakeTicketMoves implements Pick<TicketStatusService, 'moveToPlan'> {
  moveFailure: Error | undefined;
  readonly calls: string[] = [];

  async moveToPlan(projectId: string, ticketNumber: number): Promise<void> {
    this.calls.push(`moveToPlan ${projectId} #${ticketNumber}`);
    if (this.moveFailure !== undefined) {
      throw this.moveFailure;
    }
  }
}

function createTestApp(ticketMoves: FakeTicketMoves): Hono {
  return new Hono().route('/api/projects', createTicketMoveToPlanRoutes(ticketMoves));
}

describe('createTicketMoveToPlanRoutes', () => {
  describe('POST /api/projects/:owner/:name/tickets/:number/move-to-plan', () => {
    it('should answer 204 with an empty body when the move succeeds', async () => {
      const ticketMoves = new FakeTicketMoves();

      const response = await createTestApp(ticketMoves).request(
        '/api/projects/owner/name/tickets/7/move-to-plan',
        { method: 'POST' },
      );

      expect(response.status).toBe(204);
      expect(await response.text()).toBe('');
      expect(ticketMoves.calls).toEqual(['moveToPlan owner/name #7']);
    });

    it('should answer 409 with the message when the ticket is not in backlog', async () => {
      const ticketMoves = new FakeTicketMoves();
      ticketMoves.moveFailure = new TicketNotMovableError('#7 is not in backlog');

      const response = await createTestApp(ticketMoves).request(
        '/api/projects/owner/name/tickets/7/move-to-plan',
        { method: 'POST' },
      );

      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({ message: '#7 is not in backlog' });
    });

    it('should answer 400 and not move when the ticket number is bad', async () => {
      const ticketMoves = new FakeTicketMoves();

      const response = await createTestApp(ticketMoves).request(
        '/api/projects/owner/name/tickets/abc/move-to-plan',
        { method: 'POST' },
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        message: 'The ticket number must be a positive integer',
      });
      expect(ticketMoves.calls).toEqual([]);
    });
  });
});
