import { describe, expect, it, vi } from 'vitest';
import type { WaitingRun } from '../../../../../src/modules/scheduler/logic/domain/types/waiting-run.js';
import type { ProjectLookup } from '../../../../../src/modules/scheduler/logic/ports/project-lookup.js';
import { SettleWaitingRunUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/settle-waiting-run-use-case.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import { FakeProjectLookup, FakeTicketStatusWrites } from '../../fakes/fake-scheduler-ports.js';

const waitingRun: WaitingRun = {
  runId: 'r1',
  projectId: 'moritz/aisf',
  ticketNumber: 7,
  wait: { kind: 'checkpoint', request: 'Pick A or B' },
};

function buildSubject(projectLookup: ProjectLookup = new FakeProjectLookup()) {
  const ticketStatusWrites = new FakeTicketStatusWrites();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const events = new FakeEventPublisher();
  const useCase = new SettleWaitingRunUseCase({
    ticketStatusWrites,
    projectLookup,
    events,
    logger,
  });
  return { useCase, ticketStatusWrites, logger, events };
}

describe('SettleWaitingRunUseCase', () => {
  it('should set waiting, announce it and post the request once when the run waits live', async () => {
    const { useCase, ticketStatusWrites, events } = buildSubject();

    await useCase.execute(waitingRun);

    expect(ticketStatusWrites.calls).toEqual([
      'readStatus',
      'setStatus #7 -> waiting',
      'comment #7: The run reached its human checkpoint and waits for an answer on the ticket page:\n\nPick A or B',
    ]);
    expect(events.emittedEvents).toEqual([
      {
        name: 'ticket.status-written',
        payload: { projectId: 'moritz/aisf', ticketNumber: 7, from: 'in-progress', to: 'waiting' },
      },
    ]);
  });

  it('should change nothing and warn when the project is unknown', async () => {
    const { useCase, ticketStatusWrites, logger, events } = buildSubject({
      find: async () => undefined,
    });

    await useCase.execute(waitingRun);

    expect(ticketStatusWrites.calls).toEqual([]);
    expect(events.emittedEvents).toEqual([]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('should write nothing when the ticket is already waiting', async () => {
    const { useCase, ticketStatusWrites } = buildSubject();
    ticketStatusWrites.liveStatus = 'waiting';

    await useCase.execute(waitingRun);

    expect(ticketStatusWrites.calls).toEqual(['readStatus']);
  });
});
