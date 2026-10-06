import type { RunAnswer } from '../domain/types/run-answer.js';
import type { Run } from '../domain/types/run.js';
import type { RunAnswerWaits } from '../ports/run-answer-waits.js';
import type { RunRepository } from '../ports/run-repository.js';

export type DeliverRunAnswerDependencies = {
  readonly runRepository: RunRepository;
  readonly runAnswerWaits: RunAnswerWaits;
  readonly resumeRun: (runId: string, answer: RunAnswer) => Promise<Run>;
};

export class DeliverRunAnswerUseCase {
  constructor(private readonly dependencies: DeliverRunAnswerDependencies) {}

  async execute(runId: string, answer: RunAnswer): Promise<Run> {
    const { runRepository, runAnswerWaits, resumeRun } = this.dependencies;

    if (answer.kind === 'checkpoint' && runAnswerWaits.deliver(runId, answer.text)) {
      const waitingRun = await runRepository.findById(runId);
      if (waitingRun !== undefined) {
        return waitingRun;
      }
    }
    return resumeRun(runId, answer);
  }
}
