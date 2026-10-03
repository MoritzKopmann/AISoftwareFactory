import { describe, expect, it, vi } from 'vitest';
import type { FinishedRun } from '../../../../../src/modules/scheduler/logic/domain/types/finished-run.js';
import type { ProjectLookup } from '../../../../../src/modules/scheduler/logic/ports/project-lookup.js';
import { SettleFinishedRunUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/settle-finished-run-use-case.js';
import { FakeEventPublisher } from '../../../../fakes/fake-event-publisher.js';
import {
  FakeProjectLookup,
  FakeRunnerPort,
  FakeTicketStatusWrites,
} from '../../fakes/fake-scheduler-ports.js';

const escalatedRun: FinishedRun = {
  runId: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 138,
  ending: { kind: 'escalated', escalation: 'spec', reason: 'AC is vague' },
};

function buildSubject(projectLookup: ProjectLookup = new FakeProjectLookup()) {
  const ticketStatusWrites = new FakeTicketStatusWrites();
  const runner = new FakeRunnerPort();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const events = new FakeEventPublisher();
  const useCase = new SettleFinishedRunUseCase({
    ticketStatusWrites,
    runner,
    projectLookup,
    events,
    logger,
  });
  return { useCase, ticketStatusWrites, runner, logger, events };
}

describe('SettleFinishedRunUseCase', () => {
  it('should set the status, then comment, then settle the run when the ticket is in-progress after an escalation', async () => {
    const { useCase, ticketStatusWrites, runner } = buildSubject();

    await useCase.execute(escalatedRun);

    expect(ticketStatusWrites.calls).toEqual([
      'readStatus',
      'setStatus #138 -> stuck',
      'comment #138: The run escalated (spec): AC is vague',
    ]);
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should set waiting, post the request and settle the run when the run reached its checkpoint', async () => {
    const { useCase, ticketStatusWrites, runner } = buildSubject();

    await useCase.execute({
      ...escalatedRun,
      ending: { kind: 'checkpoint', request: 'Check the waiting chip' },
    });

    expect(ticketStatusWrites.calls).toEqual([
      'readStatus',
      'setStatus #138 -> waiting',
      'comment #138: The run reached its human checkpoint and waits for an answer on the ticket page:\n\nCheck the waiting chip',
    ]);
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should return the ticket to ready without a comment and settle when the run parked', async () => {
    const { useCase, ticketStatusWrites, runner } = buildSubject();

    await useCase.execute({
      ...escalatedRun,
      ending: { kind: 'parked', blockerNumber: 12 },
    });

    expect(ticketStatusWrites.calls).toEqual(['readStatus', 'setStatus #138 -> ready']);
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should write nothing and settle when the ticket is already in-review', async () => {
    const { useCase, ticketStatusWrites, runner } = buildSubject();
    ticketStatusWrites.liveStatus = 'in-review';

    await useCase.execute({ ...escalatedRun, ending: { kind: 'finished' } });

    expect(ticketStatusWrites.calls).toEqual(['readStatus']);
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should write nothing and settle when the ticket was moved to stuck during the run', async () => {
    const { useCase, ticketStatusWrites, runner } = buildSubject();
    ticketStatusWrites.liveStatus = 'stuck';

    await useCase.execute(escalatedRun);

    expect(ticketStatusWrites.calls).toEqual(['readStatus']);
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should write nothing and settle when a parked run finds the ticket ready', async () => {
    const { useCase, ticketStatusWrites, runner } = buildSubject();
    ticketStatusWrites.liveStatus = 'ready';

    await useCase.execute({ ...escalatedRun, ending: { kind: 'parked', blockerNumber: 12 } });

    expect(ticketStatusWrites.calls).toEqual(['readStatus']);
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should write nothing the second time when the same run.finished is replayed', async () => {
    const { useCase, ticketStatusWrites } = buildSubject();

    await useCase.execute(escalatedRun);
    const callsAfterFirstSettlement = ticketStatusWrites.calls.length;
    await useCase.execute(escalatedRun);

    expect(ticketStatusWrites.calls.slice(callsAfterFirstSettlement)).toEqual(['readStatus']);
  });

  it('should write nothing, log it and settle when the project is unknown', async () => {
    const { useCase, ticketStatusWrites, runner, logger } = buildSubject({
      find: async () => undefined,
    });

    await useCase.execute(escalatedRun);

    expect(ticketStatusWrites.calls).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should not settle the run when a ticket write throws', async () => {
    const { useCase, ticketStatusWrites, runner } = buildSubject();
    ticketStatusWrites.comment = async () => {
      throw new Error('gh failed');
    };

    await expect(useCase.execute(escalatedRun)).rejects.toThrow('gh failed');
    expect(runner.calls).toEqual([]);
  });

  it('should announce the stuck write after setStatus and before comment when the run needs permission', async () => {
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
          to: 'stuck',
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
        },
      },
    ]);
  });

  it('should announce nothing and still settle when no transition is needed', async () => {
    const { useCase, ticketStatusWrites, runner, events } = buildSubject();
    ticketStatusWrites.liveStatus = 'in-review';

    await useCase.execute({ ...escalatedRun, ending: { kind: 'finished' } });

    expect(events.emittedEvents).toEqual([]);
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should announce nothing when the project is unknown', async () => {
    const { useCase, events } = buildSubject({ find: async () => undefined });

    await useCase.execute(escalatedRun);

    expect(events.emittedEvents).toEqual([]);
  });

  it('should announce nothing and rethrow when setStatus throws', async () => {
    const { useCase, ticketStatusWrites, events } = buildSubject();
    const failure = new Error('gh failed');
    ticketStatusWrites.setStatusFailure = failure;

    await expect(useCase.execute(escalatedRun)).rejects.toBe(failure);

    expect(events.emittedEvents).toEqual([]);
  });
});
