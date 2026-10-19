import { isAnswerFor } from '../domain/functions/is-answer-for.js';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { Run } from '../domain/types/run.js';
import { RunNotResumableError } from '../errors/run-not-resumable-error.js';
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
      await runRepository.clearHeldAnswer(runId);
      return waitingRun;
    }
    const resumedRun = await runStartService.resume(runId, answer);
    await runRepository.clearHeldAnswer(runId);
    return resumedRun;
  }

  /** Keeps an answer on the run until the scheduler delivers it. A second answer replaces it. */
  async holdAnswer(runId: string, answer: RunAnswer): Promise<void> {
    const { runRepository } = this.dependencies;

    const run = await runRepository.findById(runId);
    if (run === undefined) {
      throw new RunNotResumableError(`Run ${runId} is unknown`);
    }
    if (!canHold(run, answer)) {
      throw new RunNotResumableError(`Run ${runId} cannot hold a ${answer.kind} answer`);
    }
    await runRepository.recordHeldAnswer(runId, answer);
  }
}

function canHold(run: Run, answer: RunAnswer): boolean {
  const answersWait = run.waitingFor !== undefined && isAnswerFor(run.waitingFor, answer);
  const answersEnding =
    (run.ending?.kind === 'permission-needed' && answer.kind === 'permission') ||
    (run.ending?.kind === 'checkpoint' && answer.kind === 'checkpoint');
  return answersWait || answersEnding;
}
