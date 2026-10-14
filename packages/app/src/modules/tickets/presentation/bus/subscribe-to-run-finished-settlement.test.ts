import { describe, expect, it, vi } from 'vitest';
import { subscribeToRunFinishedSettlement } from './subscribe-to-run-finished-settlement.js';
import { TicketStatusService } from '../../business/service/ticket-status-service.js';
import { unusedTicketStatusDependencies } from '../../testing/unused-dependencies.js';
import type { DomainEvents } from '../../../../shared/event-bus.js';
import { InMemoryEventBus } from '../../../../shared/in-memory-event-bus.js';
import { FakeRegisteredRepositories } from '../../testing/fake-tickets-ports.js';
import {
  FakeRunSettlement,
  FakeTicketStatusWrites,
} from '../../testing/fake-ticket-status-writes.js';

const runFinished: DomainEvents['run.finished'] = {
  runId: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 138,
  stage: 'implement',
  ending: { kind: 'stopped' },
};

function buildSubject() {
  const bus = new InMemoryEventBus<DomainEvents>();
  const ticketStatusWrites = new FakeTicketStatusWrites();
  const runSettlement = new FakeRunSettlement();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const settleFinishedRun = new TicketStatusService({
    ...unusedTicketStatusDependencies,
    ticketStatusWrites,
    runSettlement,
    registeredRepositories: new FakeRegisteredRepositories([
      { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
    ]),
    events: bus,
    logger,
  });
  const unsubscribe = subscribeToRunFinishedSettlement(bus, settleFinishedRun, logger);
  return { bus, ticketStatusWrites, runSettlement, logger, unsubscribe };
}

describe('subscribeToRunFinishedSettlement', () => {
  it('should settle the run on GitHub and the runSettlement when run.finished is emitted', async () => {
    const { bus, ticketStatusWrites, runSettlement } = buildSubject();

    bus.emit('run.finished', runFinished);

    await vi.waitFor(() => expect(runSettlement.calls).toEqual(['settle run-1']));
    expect(ticketStatusWrites.calls).toContain('comment #138: The run was stopped');
  });

  it('should log the failure and not throw when settling fails', async () => {
    const { bus, ticketStatusWrites, logger } = buildSubject();
    ticketStatusWrites.readState = async () => {
      throw new Error('gh failed');
    };

    expect(() => bus.emit('run.finished', runFinished)).not.toThrow();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('gh failed')),
    );
  });

  it('should stop settling when the returned unsubscribe is called', async () => {
    const { bus, runSettlement, unsubscribe } = buildSubject();

    unsubscribe();
    bus.emit('run.finished', runFinished);
    await Promise.resolve();

    expect(runSettlement.calls).toEqual([]);
  });
});
