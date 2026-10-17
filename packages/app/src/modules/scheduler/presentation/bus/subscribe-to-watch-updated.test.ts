import { describe, expect, it, vi } from 'vitest';
import { subscribeToWatchUpdated } from './subscribe-to-watch-updated.js';
import type { TicketRunService } from '../../business/service/ticket-run-service.js';
import type { DomainEvents } from '../../../../shared/event-bus.js';
import { InMemoryEventBus } from '../../../../shared/in-memory-event-bus.js';

const watchUpdated: DomainEvents['watch.updated'] = {
  projectId: 'owner/name',
  changed: false,
  polledAt: '2026-10-17T10:00:00.000Z',
};

function buildSubject(startDue: TicketRunService['startDue'] = async () => []) {
  const bus = new InMemoryEventBus<DomainEvents>();
  const startDueSpy = vi.fn(startDue);
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const unsubscribe = subscribeToWatchUpdated(bus, { startDue: startDueSpy }, logger);
  return { bus, startDueSpy, logger, unsubscribe };
}

describe('subscribeToWatchUpdated', () => {
  it('should start the due tickets of the project when watch.updated is emitted without changes', async () => {
    const { bus, startDueSpy } = buildSubject();

    bus.emit('watch.updated', watchUpdated);

    await vi.waitFor(() => expect(startDueSpy).toHaveBeenCalledWith('owner/name'));
  });

  it('should log the failure and not throw when startDue rejects', async () => {
    const { bus, logger } = buildSubject(async () => {
      throw new Error('boom');
    });

    expect(() => bus.emit('watch.updated', watchUpdated)).not.toThrow();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom')),
    );
  });

  it('should stop starting tickets when the returned unsubscribe is called', async () => {
    const { bus, startDueSpy, unsubscribe } = buildSubject();

    unsubscribe();
    bus.emit('watch.updated', watchUpdated);
    await Promise.resolve();

    expect(startDueSpy).not.toHaveBeenCalled();
  });
});
