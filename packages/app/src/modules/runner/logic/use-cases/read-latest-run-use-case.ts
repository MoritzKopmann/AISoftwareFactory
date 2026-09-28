import type { Run } from '../domain/types/run.js';
import type { RunRepository } from '../ports/run-repository.js';

export type ReadLatestRunDependencies = {
  readonly runRepository: RunRepository;
};

export class ReadLatestRunUseCase {
  constructor(private readonly dependencies: ReadLatestRunDependencies) {}

  execute(projectId: string, ticketNumber: number): Promise<Run | undefined> {
    return this.dependencies.runRepository.findLatest(projectId, ticketNumber);
  }
}
