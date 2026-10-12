import type { ActiveRun, RunnerModule } from '../../../../src/modules/runner/index.js';

export class FakeRunnerActiveRuns implements Pick<RunnerModule, 'activeRuns'> {
  readonly requestedProjectIds: string[] = [];

  constructor(private readonly activeRunList: ReadonlyArray<ActiveRun>) {}

  async activeRuns(projectId: string): Promise<ReadonlyArray<ActiveRun>> {
    this.requestedProjectIds.push(projectId);
    return this.activeRunList;
  }
}
