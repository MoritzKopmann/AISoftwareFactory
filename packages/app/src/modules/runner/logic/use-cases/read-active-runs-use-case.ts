import type { Run } from '../domain/types/run.js';
import type { RunStep } from '../domain/types/run-step.js';
import type { RecentRunSteps } from '../ports/recent-run-steps.js';
import type { RunRepository } from '../ports/run-repository.js';

export type ReadActiveRunsDependencies = {
  readonly runRepository: RunRepository;
  readonly recentRunSteps: RecentRunSteps;
};

export type ActiveRun = {
  readonly run: Run;
  readonly steps: ReadonlyArray<RunStep>;
};

export class ReadActiveRunsUseCase {
  constructor(private readonly dependencies: ReadActiveRunsDependencies) {}

  async execute(projectId: string): Promise<ReadonlyArray<ActiveRun>> {
    const runs = await this.dependencies.runRepository.listActive(projectId);
    return runs.map((run) => ({ run, steps: this.dependencies.recentRunSteps.read(run.id) }));
  }
}
