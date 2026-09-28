import { RunNotActiveError } from '../errors/run-not-active-error.js';
import type { RunRepository } from '../ports/run-repository.js';
import type { FinishRunUseCase } from './finish-run-use-case.js';

export type StopRunDependencies = {
  readonly runRepository: RunRepository;
  readonly finishRun: FinishRunUseCase;
};

export class StopRunUseCase {
  constructor(private readonly dependencies: StopRunDependencies) {}

  async execute(runId: string): Promise<void> {
    const run = await this.dependencies.runRepository.findById(runId);
    if (run?.state !== 'running') {
      throw new RunNotActiveError(`Run ${runId} is not running`);
    }

    await this.dependencies.finishRun.execute(runId, { kind: 'stopped' });
  }
}
