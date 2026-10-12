import type { RunSettlement } from '../../logic/ports/run-settlement.js';
import type { RunnerModule } from '../../../runner/index.js';

export class RunnerModuleRunSettlement implements RunSettlement {
  constructor(private readonly runner: () => Pick<RunnerModule, 'settle'>) {}

  settle(runId: string): Promise<void> {
    return this.runner().settle(runId);
  }
}
