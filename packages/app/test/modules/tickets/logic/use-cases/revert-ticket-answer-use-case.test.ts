import { describe, expect, it } from 'vitest';
import { RevertTicketAnswerUseCase } from '../../../../../src/modules/tickets/logic/use-cases/revert-ticket-answer-use-case.js';
import { FakeEventPublisher } from '../../../../../src/shared/testing/fake-event-publisher.js';
import { FakeRegisteredRepositories } from '../../fakes/fake-tickets-ports.js';
import { FakeTicketStatusWrites } from '../../fakes/fake-ticket-status-writes.js';

describe('RevertTicketAnswerUseCase', () => {
  it('should restore the waiting label and announce it when an answer is reverted', async () => {
    const ticketStatusWrites = new FakeTicketStatusWrites();
    const events = new FakeEventPublisher();
    const useCase = new RevertTicketAnswerUseCase({
      ticketStatusWrites,
      registeredRepositories: new FakeRegisteredRepositories([
        { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
      ]),
      events,
    });

    await useCase.execute('moritz/aisf', 147);

    expect(ticketStatusWrites.calls).toEqual(['readState', 'setSecondaryState #147 waiting on']);
    expect(events.emittedEvents).toEqual([
      {
        name: 'ticket.status-written',
        payload: {
          projectId: 'moritz/aisf',
          ticketNumber: 147,
          from: 'in-progress',
          to: 'in-progress',
          waiting: true,
          stuck: false,
        },
      },
    ]);
  });
});
