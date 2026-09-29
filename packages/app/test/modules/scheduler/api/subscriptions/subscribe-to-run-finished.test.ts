import { describe, expect, it, vi } from 'vitest';
import { subscribeToRunFinished } from '../../../../../src/modules/scheduler/api/subscriptions/subscribe-to-run-finished.js';
import { SettleFinishedRunUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/settle-finished-run-use-case.js';
import type { AisfEventMap } from '../../../../../src/shared/bus/aisf-event-map.js';
import { TypedEventBus } from '../../../../../src/shared/bus/typed-event-bus.js';
import {
  FakeTicketStatusWrites,
  FakeProjectLookup,
  FakeRunnerPort,
} from '../../fakes/fake-scheduler-ports.js';

const runFinished: AisfEventMap['run.finished'] = {
  runId: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 138,
  ending: { kind: 'stopped' },
};

function buildSubject() {
  const bus = new TypedEventBus<AisfEventMap>();
  const ticketStatusWrites = new FakeTicketStatusWrites();
  const runner = new FakeRunnerPort();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const settleFinishedRun = new SettleFinishedRunUseCase({
    ticketStatusWrites,
    runner,
    projectLookup: new FakeProjectLookup(),
    logger,
  });
  const unsubscribe = subscribeToRunFinished(bus, settleFinishedRun, logger);
  return { bus, ticketStatusWrites, runner, logger, unsubscribe };
}

describe('subscribeToRunFinished', () => {
  it('should settle the run on GitHub and the runner when run.finished is emitted', async () => {
    const { bus, ticketStatusWrites, runner } = buildSubject();

    bus.emit('run.finished', runFinished);

    await vi.waitFor(() => expect(runner.calls).toEqual(['settle run-1']));
    expect(ticketStatusWrites.calls).toContain('comment #138: The run was stopped');
  });

  it('should log the failure and not throw when settling fails', async () => {
    const { bus, ticketStatusWrites, logger } = buildSubject();
    ticketStatusWrites.readStatus = async () => {
      throw new Error('gh failed');
    };

    expect(() => bus.emit('run.finished', runFinished)).not.toThrow();

    await vi.waitFor(() =>
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('gh failed')),
    );
  });

  it('should stop settling when the returned unsubscribe is called', async () => {
    const { bus, runner, unsubscribe } = buildSubject();

    unsubscribe();
    bus.emit('run.finished', runFinished);
    await Promise.resolve();

    expect(runner.calls).toEqual([]);
  });
});
