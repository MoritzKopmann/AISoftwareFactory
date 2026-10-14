import { describe, expect, it, vi } from 'vitest';
import type { FinishedRun } from '../../../../../src/modules/tickets/logic/domain/types/finished-run.js';
import type { RegisteredRepositories } from '../../../../../src/modules/tickets/logic/ports/registered-repositories.js';
import { SettleFinishedRunUseCase } from '../../../../../src/modules/tickets/logic/use-cases/settle-finished-run-use-case.js';
import { FakeEventPublisher } from '../../../../../src/shared/testing/fake-event-publisher.js';
import { FakeRegisteredRepositories } from '../../fakes/fake-tickets-ports.js';
import {
  FakeRunSettlement,
  FakeTicketStatusWrites,
} from '../../fakes/fake-ticket-status-writes.js';

const escalatedRun: FinishedRun = {
  runId: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 138,
  stage: 'implement',
  ending: { kind: 'escalated', escalation: 'spec', reason: 'AC is vague' },
};

function buildSubject(
  registeredRepositories: RegisteredRepositories = new FakeRegisteredRepositories([
    { projectId: 'moritz/aisf', repository: { owner: 'moritz', name: 'aisf' } },
  ]),
) {
  const ticketStatusWrites = new FakeTicketStatusWrites();
  const runSettlement = new FakeRunSettlement();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const events = new FakeEventPublisher();
  const useCase = new SettleFinishedRunUseCase({
    ticketStatusWrites,
    runSettlement,
    registeredRepositories,
    events,
    logger,
  });
  return { useCase, ticketStatusWrites, runSettlement, logger, events };
}

describe('SettleFinishedRunUseCase', () => {
  it('should add the stuck label, then comment, then settle the run when the ticket is in-progress after an escalation', async () => {
    const { useCase, ticketStatusWrites, runSettlement } = buildSubject();

    await useCase.execute(escalatedRun);

    expect(ticketStatusWrites.calls).toEqual([
      'readState',
      'setSecondaryState #138 stuck on',
      'comment #138: The run escalated (spec): AC is vague',
    ]);
    expect(runSettlement.calls).toEqual(['settle run-1']);
  });

  it('should add the waiting label, post the request and settle the run when the run reached its checkpoint', async () => {
    const { useCase, ticketStatusWrites, runSettlement } = buildSubject();

    await useCase.execute({
      ...escalatedRun,
      ending: { kind: 'checkpoint', request: 'Check the waiting chip' },
    });

    expect(ticketStatusWrites.calls).toEqual([
      'readState',
      'setSecondaryState #138 waiting on',
      'comment #138: The run reached its human checkpoint and waits for an answer on the ticket page:\n\nCheck the waiting chip',
    ]);
    expect(runSettlement.calls).toEqual(['settle run-1']);
  });

  it('should return the ticket to ready without a comment and settle when the run parked', async () => {
    const { useCase, ticketStatusWrites, runSettlement } = buildSubject();

    await useCase.execute({
      ...escalatedRun,
      ending: { kind: 'parked', blockerNumber: 12 },
    });

    expect(ticketStatusWrites.calls).toEqual(['readState', 'setStatus #138 -> ready']);
    expect(runSettlement.calls).toEqual(['settle run-1']);
  });

  it('should write nothing and settle when the ticket is already in-review', async () => {
    const { useCase, ticketStatusWrites, runSettlement } = buildSubject();
    ticketStatusWrites.liveStatus = 'in-review';

    await useCase.execute({ ...escalatedRun, ending: { kind: 'finished' } });

    expect(ticketStatusWrites.calls).toEqual(['readState']);
    expect(runSettlement.calls).toEqual(['settle run-1']);
  });

  it('should write nothing and settle when the ticket was marked stuck during the run', async () => {
    const { useCase, ticketStatusWrites, runSettlement } = buildSubject();
    ticketStatusWrites.liveStuck = true;

    await useCase.execute(escalatedRun);

    expect(ticketStatusWrites.calls).toEqual(['readState']);
    expect(runSettlement.calls).toEqual(['settle run-1']);
  });

  it('should write nothing and settle when a parked run finds the ticket ready', async () => {
    const { useCase, ticketStatusWrites, runSettlement } = buildSubject();
    ticketStatusWrites.liveStatus = 'ready';

    await useCase.execute({ ...escalatedRun, ending: { kind: 'parked', blockerNumber: 12 } });

    expect(ticketStatusWrites.calls).toEqual(['readState']);
    expect(runSettlement.calls).toEqual(['settle run-1']);
  });

  it('should add stuck, remove waiting and keep the status when a waiting run crashed', async () => {
    const { useCase, ticketStatusWrites, events, runSettlement } = buildSubject();
    ticketStatusWrites.liveWaiting = true;

    await useCase.execute({ ...escalatedRun, ending: { kind: 'crashed', reason: 'boom' } });

    expect(ticketStatusWrites.calls).toEqual([
      'readState',
      'setSecondaryState #138 waiting off',
      'setSecondaryState #138 stuck on',
      'comment #138: The run crashed: boom',
    ]);
    expect(ticketStatusWrites.liveStatus).toBe('in-progress');
    expect(events.emittedEvents).toEqual([
      {
        name: 'ticket.status-written',
        payload: {
          projectId: 'moritz/aisf',
          ticketNumber: 138,
          from: 'in-progress',
          to: 'in-progress',
          waiting: false,
          stuck: true,
        },
      },
    ]);
    expect(runSettlement.calls).toEqual(['settle run-1']);
  });

  it('should write nothing the second time when the same run.finished is replayed', async () => {
    const { useCase, ticketStatusWrites } = buildSubject();

    await useCase.execute(escalatedRun);
    const callsAfterFirstSettlement = ticketStatusWrites.calls.length;
    await useCase.execute(escalatedRun);

    expect(ticketStatusWrites.calls.slice(callsAfterFirstSettlement)).toEqual(['readState']);
  });

  it('should write nothing, log it and settle when the project is unknown', async () => {
    const { useCase, ticketStatusWrites, runSettlement, logger } = buildSubject(
      new FakeRegisteredRepositories([]),
    );

    await useCase.execute(escalatedRun);

    expect(ticketStatusWrites.calls).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
    expect(runSettlement.calls).toEqual(['settle run-1']);
  });

  it('should not settle the run when a ticket write throws', async () => {
    const { useCase, ticketStatusWrites, runSettlement } = buildSubject();
    ticketStatusWrites.comment = async () => {
      throw new Error('gh failed');
    };

    await expect(useCase.execute(escalatedRun)).rejects.toThrow('gh failed');
    expect(runSettlement.calls).toEqual([]);
  });

  it('should announce the waiting write after the label write and before comment when the run needs permission', async () => {
    const { useCase, ticketStatusWrites, events } = buildSubject();
    let eventsSeenAtComment = -1;
    ticketStatusWrites.comment = async () => {
      eventsSeenAtComment = events.emittedEvents.length;
    };

    await useCase.execute({
      ...escalatedRun,
      ending: { kind: 'permission-needed', toolName: 'Bash', toolInput: {} },
    });

    expect(events.emittedEvents).toEqual([
      {
        name: 'ticket.status-written',
        payload: {
          projectId: 'moritz/aisf',
          ticketNumber: 138,
          from: 'in-progress',
          to: 'in-progress',
          waiting: true,
          stuck: false,
        },
      },
    ]);
    expect(eventsSeenAtComment).toBe(1);
  });

  it('should announce the ready write when the run parked', async () => {
    const { useCase, events } = buildSubject();

    await useCase.execute({ ...escalatedRun, ending: { kind: 'parked', blockerNumber: 12 } });

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

  it('should announce nothing and still settle when no transition is needed', async () => {
    const { useCase, ticketStatusWrites, runSettlement, events } = buildSubject();
    ticketStatusWrites.liveStatus = 'in-review';

    await useCase.execute({ ...escalatedRun, ending: { kind: 'finished' } });

    expect(events.emittedEvents).toEqual([]);
    expect(runSettlement.calls).toEqual(['settle run-1']);
  });

  it('should announce nothing when the project is unknown', async () => {
    const { useCase, events } = buildSubject(new FakeRegisteredRepositories([]));

    await useCase.execute(escalatedRun);

    expect(events.emittedEvents).toEqual([]);
  });

  it('should announce nothing and rethrow when the label write throws', async () => {
    const { useCase, ticketStatusWrites, events } = buildSubject();
    const failure = new Error('gh failed');
    ticketStatusWrites.setStatusFailure = failure;

    await expect(useCase.execute(escalatedRun)).rejects.toBe(failure);

    expect(events.emittedEvents).toEqual([]);
  });

  describe('authoring runs', () => {
    it('should add the stuck label and comment and keep the status when a create run crashed at idea', async () => {
      const { useCase, ticketStatusWrites } = buildSubject();
      ticketStatusWrites.liveStatus = 'idea';

      await useCase.execute({
        ...escalatedRun,
        stage: 'create',
        ending: { kind: 'crashed', reason: 'boom' },
      });

      expect(ticketStatusWrites.calls).toEqual([
        'readState',
        'setSecondaryState #138 stuck on',
        'comment #138: The run crashed: boom',
      ]);
    });

    it('should add no label when a plan run finished at plan', async () => {
      const { useCase, ticketStatusWrites, runSettlement } = buildSubject();
      ticketStatusWrites.liveStatus = 'plan';

      await useCase.execute({ ...escalatedRun, stage: 'plan', ending: { kind: 'finished' } });

      expect(ticketStatusWrites.calls).toEqual(['readState']);
      expect(runSettlement.calls).toEqual(['settle run-1']);
    });
  });
});
