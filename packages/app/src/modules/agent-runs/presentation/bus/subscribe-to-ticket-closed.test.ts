import { describe, expect, it, vi } from 'vitest';
import type { DomainEvents } from '../../../../shared/event-bus.js';
import { InMemoryEventBus } from '../../../../shared/in-memory-event-bus.js';
import type { WorktreeRemovalService } from '../../business/service/worktree-removal-service.js';
import { subscribeToTicketClosed } from './subscribe-to-ticket-closed.js';

function buildSubject(removeForClosedTicket: WorktreeRemovalService['removeForClosedTicket']) {
  const bus = new InMemoryEventBus<DomainEvents>();
  const removeSpy = vi.fn(removeForClosedTicket);
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const unsubscribe = subscribeToTicketClosed(bus, { removeForClosedTicket: removeSpy }, logger);
  return { bus, removeSpy, logger, unsubscribe };
}

describe('subscribeToTicketClosed', () => {
  it('should remove the worktrees of the ticket when ticket.closed is emitted', async () => {
    const { bus, removeSpy } = buildSubject(async () => undefined);

    bus.emit('ticket.closed', { projectId: 'p', ticketNumber: 7 });

    await vi.waitFor(() => expect(removeSpy).toHaveBeenCalledWith('p', 7));
  });

  it('should log the failure and not throw when the removal rejects', async () => {
    const { bus, logger } = buildSubject(async () => {
      throw new Error('boom');
    });

    expect(() => bus.emit('ticket.closed', { projectId: 'p', ticketNumber: 7 })).not.toThrow();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom')),
    );
  });

  it('should not remove anything when ticket.closed is emitted after unsubscribe', async () => {
    const { bus, removeSpy, unsubscribe } = buildSubject(async () => undefined);

    unsubscribe();
    bus.emit('ticket.closed', { projectId: 'p', ticketNumber: 7 });
    await Promise.resolve();

    expect(removeSpy).not.toHaveBeenCalled();
  });
});
