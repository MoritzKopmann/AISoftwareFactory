import { describe, expect, it } from 'vitest';
import { TicketNotResettableError } from '../../../../../src/modules/scheduler/logic/errors/ticket-not-resettable-error.js';
import type { ProjectLookup } from '../../../../../src/modules/scheduler/logic/ports/project-lookup.js';
import { ResetTicketUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/reset-ticket-use-case.js';
import type { TicketStatus } from '../../../../../src/shared/ticket-status/ticket-status.js';
import {
  FakeProjectLookup,
  FakeRunnerPort,
  FakeTicketStatusWrites,
} from '../../fakes/fake-scheduler-ports.js';

function buildSubject(
  liveStatus: TicketStatus,
  projectLookup: ProjectLookup = new FakeProjectLookup(),
) {
  const ticketStatusWrites = new FakeTicketStatusWrites();
  ticketStatusWrites.liveStatus = liveStatus;
  const runner = new FakeRunnerPort();
  const useCase = new ResetTicketUseCase({ ticketStatusWrites, runner, projectLookup });
  return { useCase, ticketStatusWrites, runner };
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
    const { useCase, ticketStatusWrites, runner } = buildSubject('stuck');
    runner.activeTicketNumbers = [140];

    await useCase.execute('moritz/aisf', 138);

    expect(ticketStatusWrites.calls).toContain('setStatus #138 -> ready');
  });

  it('should throw and write nothing when the ticket has an active run', async () => {
    const { useCase, ticketStatusWrites, runner } = buildSubject('in-progress');
    runner.activeTicketNumbers = [138];

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
    class UnknownProjectLookup implements ProjectLookup {
      async find(): Promise<undefined> {
        return undefined;
      }
    }
    const { useCase, ticketStatusWrites } = buildSubject('stuck', new UnknownProjectLookup());

    await expect(useCase.execute('moritz/unknown', 138)).rejects.toBeInstanceOf(
      TicketNotResettableError,
    );
    expect(ticketStatusWrites.calls).toEqual([]);
  });
});
