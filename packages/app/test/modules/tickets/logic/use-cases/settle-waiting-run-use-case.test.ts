import { describe, expect, it, vi } from 'vitest';
import type { WaitingRun } from '../../../../../src/modules/tickets/logic/domain/types/waiting-run.js';
import type { RegisteredRepositories } from '../../../../../src/modules/tickets/logic/ports/registered-repositories.js';
import { SettleWaitingRunUseCase } from '../../../../../src/modules/tickets/logic/use-cases/settle-waiting-run-use-case.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import { FakeRegisteredRepositories } from '../../fakes/fake-tickets-ports.js';
import { FakeTicketStatusWrites } from '../../fakes/fake-ticket-status-writes.js';

const waitingRun: WaitingRun = {
  runId: 'r1',
  projectId: 'moritz/aisf',
  ticketNumber: 7,
  wait: { kind: 'checkpoint', request: 'Pick A or B' },
};

function buildSubject(
  registeredRepositories: RegisteredRepositories = new FakeRegisteredRepositories([
    { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
  ]),
) {
  const ticketStatusWrites = new FakeTicketStatusWrites();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const events = new FakeEventPublisher();
  const useCase = new SettleWaitingRunUseCase({
    ticketStatusWrites,
    registeredRepositories,
    events,
    logger,
  });
  return { useCase, ticketStatusWrites, logger, events };
}

describe('SettleWaitingRunUseCase', () => {
  it('should add the waiting label, keep the status, announce it and post the request once when the run waits live', async () => {
    const { useCase, ticketStatusWrites, events } = buildSubject();

    await useCase.execute(waitingRun);

    expect(ticketStatusWrites.calls).toEqual([
      'readState',
      'setSecondaryState #7 waiting on',
      'comment #7: The run reached its human checkpoint and waits for an answer on the ticket page:\n\nPick A or B',
    ]);
    expect(events.emittedEvents).toEqual([
      {
        name: 'ticket.status-written',
        payload: {
          projectId: 'moritz/aisf',
          ticketNumber: 7,
          from: 'in-progress',
          to: 'in-progress',
          waiting: true,
          stuck: false,
        },
      },
    ]);
  });

  it('should change nothing and warn when the project is unknown', async () => {
    const { useCase, ticketStatusWrites, logger, events } = buildSubject(
      new FakeRegisteredRepositories([]),
    );

    await useCase.execute(waitingRun);

    expect(ticketStatusWrites.calls).toEqual([]);
    expect(events.emittedEvents).toEqual([]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('should write nothing when the ticket is already waiting', async () => {
    const { useCase, ticketStatusWrites } = buildSubject();
    ticketStatusWrites.liveWaiting = true;

    await useCase.execute(waitingRun);

    expect(ticketStatusWrites.calls).toEqual(['readState']);
  });
});
