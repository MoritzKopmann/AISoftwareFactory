import type { RunWait, RunWaitLookup } from '../../logic/ports/run-wait-lookup.js';
import type { RunnerModule } from '../../../runner/index.js';

export class RunnerModuleRunWaitLookup implements RunWaitLookup {
  constructor(private readonly runner: () => Pick<RunnerModule, 'activeWaits'>) {}

  waitsOf(projectId: string): Promise<ReadonlyArray<RunWait>> {
    return this.runner().activeWaits(projectId);
  }
}
