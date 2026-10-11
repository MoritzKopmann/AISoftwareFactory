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
  flags: { waiting?: boolean; stuck?: boolean } = {},
  registeredRepositories: RegisteredRepositories = new FakeRegisteredRepositories([
    { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
  ]),
) {
  const ticketStatusWrites = new FakeTicketStatusWrites();
  ticketStatusWrites.liveStatus = liveStatus;
  ticketStatusWrites.liveWaiting = flags.waiting ?? false;
  ticketStatusWrites.liveStuck = flags.stuck ?? false;
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
  it('should set the ticket ready and clear the stuck label when it is in-progress and stuck', async () => {
    const { useCase, ticketStatusWrites } = buildSubject('in-progress', { stuck: true });

    await useCase.execute('moritz/aisf', 138);

    expect(ticketStatusWrites.calls).toEqual([
      'readState',
      'setStatus #138 -> ready',
      'setSecondaryState #138 stuck off',
    ]);
  });

  it('should clear both labels when the ticket is waiting and stuck', async () => {
    const { useCase, ticketStatusWrites } = buildSubject('in-progress', {
      waiting: true,
      stuck: true,
    });

    await useCase.execute('moritz/aisf', 138);

    expect(ticketStatusWrites.calls).toEqual([
      'readState',
      'setStatus #138 -> ready',
      'setSecondaryState #138 waiting off',
      'setSecondaryState #138 stuck off',
    ]);
  });

  it('should only set the status when the ticket is in-progress without flags', async () => {
    const { useCase, ticketStatusWrites } = buildSubject('in-progress');

    await useCase.execute('moritz/aisf', 138);

    expect(ticketStatusWrites.calls).toEqual(['readState', 'setStatus #138 -> ready']);
  });

  it('should reset a ready ticket when it carries the stuck label', async () => {
    const { useCase, ticketStatusWrites } = buildSubject('ready', { stuck: true });

    await useCase.execute('moritz/aisf', 138);

    expect(ticketStatusWrites.calls).toContain('setSecondaryState #138 stuck off');
  });

  it('should set the ticket ready when the active run is on another ticket', async () => {
    const { useCase, ticketStatusWrites, activeRunLookup } = buildSubject('in-progress', {
      stuck: true,
    });
    activeRunLookup.activeTicketNumbers = [140];

    await useCase.execute('moritz/aisf', 138);

    expect(ticketStatusWrites.calls).toContain('setStatus #138 -> ready');
  });

  it('should throw and write nothing when the ticket has an active run', async () => {
    const { useCase, ticketStatusWrites, activeRunLookup } = buildSubject('in-progress', {
      stuck: true,
    });
    activeRunLookup.activeTicketNumbers = [138];

    await expect(useCase.execute('moritz/aisf', 138)).rejects.toBeInstanceOf(
      TicketNotResettableError,
    );
    expect(ticketStatusWrites.calls).toEqual([]);
  });

  it.each(['ready', 'in-review'] as const)(
    'should throw and write nothing when the ticket status is %s without a stuck label',
    async (status) => {
      const { useCase, ticketStatusWrites } = buildSubject(status);

      await expect(useCase.execute('moritz/aisf', 138)).rejects.toBeInstanceOf(
        TicketNotResettableError,
      );
      expect(ticketStatusWrites.calls).toEqual(['readState']);
    },
  );

  it('should throw and not touch the ticket when the project is unknown', async () => {
    const { useCase, ticketStatusWrites } = buildSubject(
      'in-progress',
      { stuck: true },
      new FakeRegisteredRepositories([]),
    );

    await expect(useCase.execute('moritz/unknown', 138)).rejects.toBeInstanceOf(
      TicketNotResettableError,
    );
    expect(ticketStatusWrites.calls).toEqual([]);
  });

  it('should emit ticket.status-written to ready with both flags off when the reset succeeds', async () => {
    const { useCase, events } = buildSubject('in-progress', { stuck: true });

    await useCase.execute('moritz/aisf', 138);

    expect(events.emittedEvents).toEqual([
      {
        name: 'ticket.status-written',
        payload: {
          projectId: 'moritz/aisf',
          ticketNumber: 138,
          from: 'in-progress',
          to: 'ready',
          waiting: false,
          stuck: false,
        },
      },
    ]);
  });

  it('should emit nothing when the ticket has an active run', async () => {
    const { useCase, activeRunLookup, events } = buildSubject('in-progress', { stuck: true });
    activeRunLookup.activeTicketNumbers = [138];

    await expect(useCase.execute('moritz/aisf', 138)).rejects.toBeInstanceOf(
      TicketNotResettableError,
    );
    expect(events.emittedEvents).toEqual([]);
  });

  it('should emit nothing when the status write fails', async () => {
    const { useCase, ticketStatusWrites, events } = buildSubject('in-progress', { stuck: true });
    ticketStatusWrites.setStatusFailure = new Error('gh failed');

    await expect(useCase.execute('moritz/aisf', 138)).rejects.toThrow('gh failed');
    expect(events.emittedEvents).toEqual([]);
  });

  it.each(['idea', 'plan'] as const)(
    'should clear the stuck label and keep the status when an authoring ticket at %s is reset',
    async (status) => {
      const { useCase, ticketStatusWrites, events } = buildSubject(status, { stuck: true });

      await useCase.execute('moritz/aisf', 7);

      expect(ticketStatusWrites.calls).toEqual(['readState', 'setSecondaryState #7 stuck off']);
      expect(events.emittedEvents).toMatchObject([
        { payload: { from: status, to: status, waiting: false, stuck: false } },
      ]);
    },
  );
});
