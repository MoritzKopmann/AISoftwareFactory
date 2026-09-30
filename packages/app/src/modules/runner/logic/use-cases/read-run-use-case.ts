import type { Run } from '../domain/types/run.js';
import type { RunRepository } from '../ports/run-repository.js';

export type ReadRunDependencies = {
  readonly runRepository: RunRepository;
};

export class ReadRunUseCase {
  constructor(private readonly dependencies: ReadRunDependencies) {}

  execute(runId: string): Promise<Run | undefined> {
    return this.dependencies.runRepository.findById(runId);
  }
}
