import { describe, expect, it } from 'vitest';
import { TicketNotResettableError } from '../../../../../src/modules/tickets/logic/errors/ticket-not-resettable-error.js';
import type { RegisteredRepositories } from '../../../../../src/modules/tickets/logic/ports/registered-repositories.js';
import { ResetTicketUseCase } from '../../../../../src/modules/tickets/logic/use-cases/reset-ticket-use-case.js';
import type { TicketStatus } from '../../../../../src/shared/ticket-status/ticket-status.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import { FakeRegisteredRepositories } from '../../fakes/fake-tickets-ports.js';
import {
  FakeActiveRunLookup,
  FakeTicketStatusWrites,
} from '../../fakes/fake-ticket-status-writes.js';

function buildSubject(
  liveStatus: TicketStatus,
  registeredRepositories: RegisteredRepositories = new FakeRegisteredRepositories([
    { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
  ]),
) {
  const ticketStatusWrites = new FakeTicketStatusWrites();
  ticketStatusWrites.liveStatus = liveStatus;
  const activeRunLookup = new FakeActiveRunLookup();
  const events = new FakeEventPublisher();
  const useCase = new ResetTicketUseCase({
    ticketStatusWrites,
    activeRunLookup,
    registeredRepositories,
    events,
  });
  return { useCase, ticketStatusWrites, activeRunLookup, events };
}

describe('ResetTicketUseCase', () => {
  it.each(['stuck', 'in-progress'] as const)(
    'should set the ticket ready when its status is %s and no run is active',
    async (status) => {
      const { useCase, ticketStatusWrites } = buildSubject(status);

      await useCase.execute('moritz/aisf', 138);

      expect(ticketStatusWrites.calls).toEqual(['readStatus', 'setStatus #138 -> ready']);
    },
  );

  it('should set the ticket ready when the active run is on another ticket', async () => {
    const { useCase, ticketStatusWrites, activeRunLookup } = buildSubject('stuck');
    activeRunLookup.activeTicketNumbers = [140];

    await useCase.execute('moritz/aisf', 138);

    expect(ticketStatusWrites.calls).toContain('setStatus #138 -> ready');
  });

  it('should throw and write nothing when the ticket has an active run', async () => {
    const { useCase, ticketStatusWrites, activeRunLookup } = buildSubject('in-progress');
    activeRunLookup.activeTicketNumbers = [138];

    await expect(useCase.execute('moritz/aisf', 138)).rejects.toBeInstanceOf(
      TicketNotResettableError,
    );
    expect(ticketStatusWrites.calls).toEqual([]);
  });

  it.each(['waiting', 'ready', 'in-review'] as const)(
    'should throw and write nothing when the ticket status is %s',
    async (status) => {
      const { useCase, ticketStatusWrites } = buildSubject(status);

      await expect(useCase.execute('moritz/aisf', 138)).rejects.toBeInstanceOf(
        TicketNotResettableError,
      );
      expect(ticketStatusWrites.calls).toEqual(['readStatus']);
    },
  );

  it('should throw and not touch the ticket when the project is unknown', async () => {
    const { useCase, ticketStatusWrites } = buildSubject(
      'stuck',
      new FakeRegisteredRepositories([]),
    );

    await expect(useCase.execute('moritz/unknown', 138)).rejects.toBeInstanceOf(
      TicketNotResettableError,
    );
    expect(ticketStatusWrites.calls).toEqual([]);
  });

  it('should emit ticket.status-written from the read status to ready when the reset succeeds', async () => {
    const { useCase, events } = buildSubject('stuck');

    await useCase.execute('moritz/aisf', 138);

    expect(events.emittedEvents).toEqual([
      {
        name: 'ticket.status-written',
        payload: { projectId: 'moritz/aisf', ticketNumber: 138, from: 'stuck', to: 'ready' },
      },
    ]);
  });

  it('should emit nothing when the ticket has an active run', async () => {
    const { useCase, activeRunLookup, events } = buildSubject('stuck');
    activeRunLookup.activeTicketNumbers = [138];

    await expect(useCase.execute('moritz/aisf', 138)).rejects.toBeInstanceOf(
      TicketNotResettableError,
    );
    expect(events.emittedEvents).toEqual([]);
  });

  it('should emit nothing when the status write fails', async () => {
    const { useCase, ticketStatusWrites, events } = buildSubject('stuck');
    ticketStatusWrites.setStatusFailure = new Error('gh failed');

    await expect(useCase.execute('moritz/aisf', 138)).rejects.toThrow('gh failed');
    expect(events.emittedEvents).toEqual([]);
  });
});
