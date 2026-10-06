import { describe, expect, it, vi } from 'vitest';
import { subscribeToRunWaiting } from '../../../../../src/modules/scheduler/api/subscriptions/subscribe-to-run-waiting.js';
import { SettleWaitingRunUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/settle-waiting-run-use-case.js';
import type { AisfEventMap } from '../../../../../src/shared/bus/aisf-event-map.js';
import { TypedEventBus } from '../../../../../src/shared/bus/typed-event-bus.js';
import { FakeProjectLookup, FakeTicketStatusWrites } from '../../fakes/fake-scheduler-ports.js';

const runWaiting: AisfEventMap['run.waiting'] = {
  runId: 'r1',
  projectId: 'moritz/aisf',
  ticketNumber: 7,
  wait: { kind: 'checkpoint', request: 'Pick A or B' },
};

function buildSubject() {
  const bus = new TypedEventBus<AisfEventMap>();
  const ticketStatusWrites = new FakeTicketStatusWrites();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const settleWaitingRun = new SettleWaitingRunUseCase({
    ticketStatusWrites,
    projectLookup: new FakeProjectLookup(),
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

    await vi.waitFor(() => expect(ticketStatusWrites.calls).toContain('setStatus #7 -> waiting'));
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
