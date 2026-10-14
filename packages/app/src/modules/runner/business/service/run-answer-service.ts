import { isAnswerFor } from '../domain/functions/is-answer-for.js';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { Run } from '../domain/types/run.js';
import type { RunAnswerWaits } from '../port/repository/run-answer-waits.js';
import type { RunRepository } from '../port/repository/run-repository.js';
import type { RunStartService } from './run-start-service.js';

export type RunAnswerServiceDependencies = {
  readonly runRepository: RunRepository;
  readonly runAnswerWaits: RunAnswerWaits;
  readonly runStartService: Pick<RunStartService, 'resume'>;
};

/** Hands a human's answer to the run that waits for it, or resumes the ended run. */
export class RunAnswerService {
  constructor(private readonly dependencies: RunAnswerServiceDependencies) {}

  async deliverAnswer(runId: string, answer: RunAnswer): Promise<Run> {
    const { runRepository, runAnswerWaits, runStartService } = this.dependencies;

    const waitingRun = await runRepository.findById(runId);
    if (
      waitingRun?.waitingFor !== undefined &&
      isAnswerFor(waitingRun.waitingFor, answer) &&
      runAnswerWaits.deliver(runId, answer)
    ) {
      return waitingRun;
    }
    return runStartService.resume(runId, answer);
  }
}
