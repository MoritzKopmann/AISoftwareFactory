import type { Run } from '../domain/types/run.js';
import type { RunStep } from '../domain/types/run-step.js';
import type { RecentRunSteps } from '../ports/recent-run-steps.js';
import type { RunRepository } from '../ports/run-repository.js';

export type ReadActiveRunDependencies = {
  readonly runRepository: RunRepository;
  readonly recentRunSteps: RecentRunSteps;
};

export type ActiveRun = {
  readonly run: Run;
  readonly steps: ReadonlyArray<RunStep>;
};

export class ReadActiveRunUseCase {
  constructor(private readonly dependencies: ReadActiveRunDependencies) {}

  async execute(projectId: string): Promise<ActiveRun | undefined> {
    const run = await this.dependencies.runRepository.findActive(projectId);
    if (run === undefined) {
      return undefined;
    }
    return { run, steps: this.dependencies.recentRunSteps.read(run.id) };
  }
}
