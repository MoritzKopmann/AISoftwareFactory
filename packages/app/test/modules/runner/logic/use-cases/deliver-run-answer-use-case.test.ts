import { beforeEach, describe, expect, it } from 'vitest';
import { DeliverRunAnswerUseCase } from '../../../../../src/modules/runner/logic/use-cases/deliver-run-answer-use-case.js';
import type { RunAnswer } from '../../../../../src/modules/runner/logic/domain/types/run-answer.js';
import type { Run } from '../../../../../src/modules/runner/logic/domain/types/run.js';
import { buildRun, FakeRunAnswerWaits, FakeRunRepository } from '../../fakes/fake-runner-ports.js';

describe('DeliverRunAnswerUseCase', () => {
  let runRepository: FakeRunRepository;
  let runAnswerWaits: FakeRunAnswerWaits;
  let resumedAnswers: Array<{ runId: string; answer: RunAnswer }>;
  let useCase: DeliverRunAnswerUseCase;
  const resumedRun = buildRun({ id: 'run-2' });

  beforeEach(() => {
    runRepository = new FakeRunRepository();
    runAnswerWaits = new FakeRunAnswerWaits();
    resumedAnswers = [];
    useCase = new DeliverRunAnswerUseCase({
      runRepository,
      runAnswerWaits,
      resumeRun: async (runId, answer): Promise<Run> => {
        resumedAnswers.push({ runId, answer });
        return resumedRun;
      },
    });
  });

  it('should deliver to the live wait and return the waiting run when a checkpoint answer meets one', async () => {
    const waitingRun = buildRun({ waitingFor: { kind: 'checkpoint', request: 'Check' } });
    await runRepository.insert(waitingRun);
    const outcome = runAnswerWaits.wait('run-1', 1000);

    const run = await useCase.execute('run-1', { kind: 'checkpoint', text: 'Looks good' });

    expect(run).toEqual(waitingRun);
    expect(await outcome).toEqual({ kind: 'answered', text: 'Looks good' });
    expect(resumedAnswers).toEqual([]);
  });

  it('should resume the run when a checkpoint answer finds no live wait', async () => {
    const answer = { kind: 'checkpoint', text: 'Looks good' } as const;

    const run = await useCase.execute('run-1', answer);

    expect(run).toBe(resumedRun);
    expect(resumedAnswers).toEqual([{ runId: 'run-1', answer }]);
  });

  it('should resume the run when the answer is a permission answer', async () => {
    await runRepository.insert(buildRun());
    runAnswerWaits.wait('run-1', 1000);
    const answer = { kind: 'permission', decision: 'allow' } as const;

    const run = await useCase.execute('run-1', answer);

    expect(run).toBe(resumedRun);
    expect(runAnswerWaits.isWaiting('run-1')).toBe(true);
    expect(resumedAnswers).toEqual([{ runId: 'run-1', answer }]);
  });
});
