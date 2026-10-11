import { describe, expect, it } from 'vitest';
import { TicketNotAnswerableError } from '../../../../../src/modules/tickets/logic/errors/ticket-not-answerable-error.js';
import type { RegisteredRepositories } from '../../../../../src/modules/tickets/logic/ports/registered-repositories.js';
import { BeginTicketAnswerUseCase } from '../../../../../src/modules/tickets/logic/use-cases/begin-ticket-answer-use-case.js';
import type { TicketStatus } from '../../../../../src/shared/ticket-status/ticket-status.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import { FakeRegisteredRepositories } from '../../fakes/fake-tickets-ports.js';
import { FakeTicketStatusWrites } from '../../fakes/fake-ticket-status-writes.js';

function buildSubject(
  liveStatus: TicketStatus,
  registeredRepositories: RegisteredRepositories = new FakeRegisteredRepositories([
    { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
  ]),
) {
  const ticketStatusWrites = new FakeTicketStatusWrites();
  ticketStatusWrites.liveStatus = liveStatus;
  const events = new FakeEventPublisher();
  const useCase = new BeginTicketAnswerUseCase({
    ticketStatusWrites,
    registeredRepositories,
    events,
  });
  return { useCase, ticketStatusWrites, events };
}

describe('BeginTicketAnswerUseCase', () => {
  it('should write in-progress and announce it when the ticket is waiting', async () => {
    const { useCase, ticketStatusWrites, events } = buildSubject('waiting');

    await useCase.execute('moritz/aisf', 147);

    expect(ticketStatusWrites.calls).toEqual(['readStatus', 'setStatus #147 -> in-progress']);
    expect(events.emittedEvents).toEqual([
      {
        name: 'ticket.status-written',
        payload: {
          projectId: 'moritz/aisf',
          ticketNumber: 147,
          from: 'waiting',
          to: 'in-progress',
        },
      },
    ]);
  });

  it('should throw and write nothing when the ticket is not waiting', async () => {
    const { useCase, ticketStatusWrites, events } = buildSubject('in-progress');

    await expect(useCase.execute('moritz/aisf', 147)).rejects.toThrow('#147 is not waiting');

    expect(ticketStatusWrites.calls).toEqual(['readStatus']);
    expect(events.emittedEvents).toEqual([]);
  });

  it('should throw and write nothing when the project is unknown', async () => {
    const { useCase, ticketStatusWrites } = buildSubject(
      'waiting',
      new FakeRegisteredRepositories([]),
    );

    await expect(useCase.execute('moritz/aisf', 147)).rejects.toBeInstanceOf(
      TicketNotAnswerableError,
    );

    expect(ticketStatusWrites.calls).toEqual([]);
  });

  it('should announce nothing when the status write fails', async () => {
    const { useCase, ticketStatusWrites, events } = buildSubject('waiting');
    ticketStatusWrites.setStatusFailure = new Error('gh failed');

    await expect(useCase.execute('moritz/aisf', 147)).rejects.toThrow('gh failed');

    expect(events.emittedEvents).toEqual([]);
  });
});
