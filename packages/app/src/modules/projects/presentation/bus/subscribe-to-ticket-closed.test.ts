import { describe, expect, it, vi } from 'vitest';
import type { DomainEvents } from '../../../../shared/event-bus.js';
import { InMemoryEventBus } from '../../../../shared/in-memory-event-bus.js';
import type { ProjectService } from '../../business/service/project-service.js';
import { subscribeToTicketClosed } from './subscribe-to-ticket-closed.js';

function buildSubject(refreshCheckout: ProjectService['refreshCheckout']) {
  const bus = new InMemoryEventBus<DomainEvents>();
  const refreshSpy = vi.fn(refreshCheckout);
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  subscribeToTicketClosed(bus, { refreshCheckout: refreshSpy }, logger);
  return { bus, refreshSpy, logger };
}

describe('subscribeToTicketClosed', () => {
  it('should refresh the checkout of the project when ticket.closed is emitted', async () => {
    const { bus, refreshSpy } = buildSubject(async () => undefined);

    bus.emit('ticket.closed', { projectId: 'owner/name', ticketNumber: 7 });

    await vi.waitFor(() => expect(refreshSpy).toHaveBeenCalledExactlyOnceWith('owner/name'));
  });

  it('should log the failure and not throw when the refresh rejects', async () => {
    const { bus, logger } = buildSubject(async () => {
      throw new Error('boom');
    });

    expect(() => bus.emit('ticket.closed', { projectId: 'p', ticketNumber: 7 })).not.toThrow();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom')),
    );
  });
});
