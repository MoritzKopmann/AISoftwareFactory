import type { RunnerApi } from '../../../runner/index.js';
import type { RunWait, RunWaitLookup } from '../../business/port/run/run-wait-lookup.js';

export class RunnerRunWaitLookup implements RunWaitLookup {
  constructor(private readonly runner: Pick<RunnerApi, 'activeWaits'>) {}

  async waitsOf(projectId: string): Promise<ReadonlyArray<RunWait>> {
    return (await this.runner.activeWaits(projectId)).map(({ ticketNumber, kind, since }) => ({
      ticketNumber,
      kind,
      since,
    }));
  }
}
