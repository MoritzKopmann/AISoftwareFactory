import type { RunnerApi } from '../../../runner/index.js';
import type { ActiveRunLookup } from '../../business/port/run/active-run-lookup.js';

export class RunnerActiveRunLookup implements ActiveRunLookup {
  constructor(private readonly runner: Pick<RunnerApi, 'activeRuns'>) {}

  async activeRunTicketNumbers(projectId: string): Promise<ReadonlyArray<number>> {
    return (await this.runner.activeRuns(projectId)).map(({ run }) => run.ticketNumber);
  }
}
