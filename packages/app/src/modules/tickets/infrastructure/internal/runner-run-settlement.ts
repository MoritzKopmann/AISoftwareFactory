import type { RunnerApi } from '../../../runner/index.js';
import type { RunSettlement } from '../../business/port/run/run-settlement.js';

export class RunnerRunSettlement implements RunSettlement {
  constructor(private readonly runner: Pick<RunnerApi, 'settle'>) {}

  settle(runId: string): Promise<void> {
    return this.runner.settle(runId);
  }
}
