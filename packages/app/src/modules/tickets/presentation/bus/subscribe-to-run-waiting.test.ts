import { describe, expect, it, vi } from 'vitest';
import { subscribeToRunWaiting } from './subscribe-to-run-waiting.js';
import { TicketStatusService } from '../../business/service/ticket-status-service.js';
import { unusedTicketStatusDependencies } from '../../testing/unused-dependencies.js';
import type { DomainEvents } from '../../../../shared/event-bus.js';
import { InMemoryEventBus } from '../../../../shared/in-memory-event-bus.js';
import { FakeProjectPort } from '../../testing/fake-tickets-ports.js';
import { FakeTicketStatusWrites } from '../../testing/fake-ticket-status-writes.js';

const runWaiting: DomainEvents['run.waiting'] = {
  runId: 'r1',
  projectId: 'moritz/aisf',
  ticketNumber: 7,
  stage: 'implement',
  wait: { kind: 'checkpoint', request: 'Pick A or B' },
};

function buildSubject() {
  const bus = new InMemoryEventBus<DomainEvents>();
  const ticketStatusWrites = new FakeTicketStatusWrites();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const settleWaitingRun = new TicketStatusService({
    ...unusedTicketStatusDependencies,
    ticketStatusWrites,
    projectPort: new FakeProjectPort([
      { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
    ]),
    events: bus,
    logger,
  });
  const unsubscribe = subscribeToRunWaiting(bus, settleWaitingRun, logger);
  return { bus, ticketStatusWrites, logger, unsubscribe };
}

describe('subscribeToRunWaiting', () => {
  it('should mark the ticket waiting when run.waiting is emitted', async () => {
    const { bus, ticketStatusWrites } = buildSubject();

    bus.emit('run.waiting', runWaiting);

    await vi.waitFor(() =>
      expect(ticketStatusWrites.calls).toContain('setSecondaryState #7 waiting on'),
    );
  });

  it('should log the failure and not throw when the write fails', async () => {
    const { bus, ticketStatusWrites, logger } = buildSubject();
    ticketStatusWrites.setStatusFailure = new Error('gh failed');

    expect(() => bus.emit('run.waiting', runWaiting)).not.toThrow();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('gh failed')),
    );
  });

  it('should stop reacting when the returned unsubscribe is called', async () => {
    const { bus, ticketStatusWrites, unsubscribe } = buildSubject();

    unsubscribe();
    bus.emit('run.waiting', runWaiting);
    await Promise.resolve();

    expect(ticketStatusWrites.calls).toEqual([]);
  });
});
