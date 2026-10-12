import type { ActiveRunLookup } from '../../logic/ports/active-run-lookup.js';
import type { RunnerModule } from '../../../runner/index.js';

export class RunnerModuleActiveRunLookup implements ActiveRunLookup {
  constructor(private readonly runner: () => Pick<RunnerModule, 'activeRuns'>) {}

  async activeRunTicketNumbers(projectId: string): Promise<ReadonlyArray<number>> {
    const activeRuns = await this.runner().activeRuns(projectId);
    return activeRuns.map(({ run }) => run.ticketNumber);
  }
}
