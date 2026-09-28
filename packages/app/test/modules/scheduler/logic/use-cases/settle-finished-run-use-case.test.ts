import { describe, expect, it, vi } from 'vitest';
import type { FinishedRun } from '../../../../../src/modules/scheduler/logic/domain/types/finished-run.js';
import type { ProjectLookup } from '../../../../../src/modules/scheduler/logic/ports/project-lookup.js';
import { SettleFinishedRunUseCase } from '../../../../../src/modules/scheduler/logic/use-cases/settle-finished-run-use-case.js';
import {
  FakeGitHubWrites,
  FakeProjectLookup,
  FakeRunnerPort,
} from '../../fakes/fake-scheduler-ports.js';

const escalatedRun: FinishedRun = {
  runId: 'run-1',
  projectId: 'moritz/aisf',
  ticketNumber: 138,
  ending: { kind: 'escalated', escalation: 'spec', reason: 'AC is vague' },
};

function buildSubject(projectLookup: ProjectLookup = new FakeProjectLookup()) {
  const gitHubWrites = new FakeGitHubWrites();
  const runner = new FakeRunnerPort();
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
  const useCase = new SettleFinishedRunUseCase({ gitHubWrites, runner, projectLookup, logger });
  return { useCase, gitHubWrites, runner, logger };
}

describe('SettleFinishedRunUseCase', () => {
  it('should swap the status, then comment, then settle the run when the ticket is in-progress after an escalation', async () => {
    const { useCase, gitHubWrites, runner } = buildSubject();

    await useCase.execute(escalatedRun);

    expect(gitHubWrites.calls).toEqual([
      'readStatus',
      'transition #138 ready|in-progress -> stuck',
      'comment #138: The run escalated (spec): AC is vague',
    ]);
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should return the ticket to ready without a comment and settle when the run parked', async () => {
    const { useCase, gitHubWrites, runner } = buildSubject();

    await useCase.execute({
      ...escalatedRun,
      ending: { kind: 'parked', blockerNumber: 12 },
    });

    expect(gitHubWrites.calls).toEqual(['readStatus', 'transition #138 in-progress -> ready']);
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should write nothing and settle when the ticket is already in-review', async () => {
    const { useCase, gitHubWrites, runner } = buildSubject();
    gitHubWrites.liveStatus = 'in-review';

    await useCase.execute({ ...escalatedRun, ending: { kind: 'finished' } });

    expect(gitHubWrites.calls).toEqual(['readStatus']);
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should write nothing the second time when the same run.finished is replayed', async () => {
    const { useCase, gitHubWrites } = buildSubject();

    await useCase.execute(escalatedRun);
    const callsAfterFirstSettlement = gitHubWrites.calls.length;
    await useCase.execute(escalatedRun);

    expect(gitHubWrites.calls.slice(callsAfterFirstSettlement)).toEqual(['readStatus']);
  });

  it('should write no comment, log the mismatch and still settle when the guarded swap finds another status', async () => {
    const { useCase, gitHubWrites, runner, logger } = buildSubject();
    gitHubWrites.swapOutcome = { kind: 'mismatch', actualStatuses: ['stuck'] };

    await useCase.execute(escalatedRun);

    expect(gitHubWrites.calls.some((call) => call.startsWith('comment'))).toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('#138'));
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should write nothing, log it and settle when the project is unknown', async () => {
    const { useCase, gitHubWrites, runner, logger } = buildSubject({ find: async () => undefined });

    await useCase.execute(escalatedRun);

    expect(gitHubWrites.calls).toEqual([]);
    expect(logger.warn).toHaveBeenCalled();
    expect(runner.calls).toEqual(['settle run-1']);
  });

  it('should not settle the run when a GitHub write throws', async () => {
    const { useCase, gitHubWrites, runner } = buildSubject();
    gitHubWrites.comment = async () => {
      throw new Error('gh failed');
    };

    await expect(useCase.execute(escalatedRun)).rejects.toThrow('gh failed');
    expect(runner.calls).toEqual([]);
  });
});
