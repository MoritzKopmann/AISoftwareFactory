import { describe, expect, it, vi } from 'vitest';
import type { FinishedRun } from '../../../../../src/modules/scheduler/logic/domain/types/finished-run.js';
import type { ProjectLookup } from '../../../../../src/modules/scheduler/logic/ports/project-lookup.js';
import { SettleFinishedRunUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/settle-finished-run-use-case.js';
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
  const useCase = new SettleFinishedRunUseCase({
    ticketStatusWrites,
    runner,
    projectLookup,
    logger,
  });
  return { useCase, ticketStatusWrites, runner, logger };
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
});
