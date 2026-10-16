import type { AgentRunsApi } from '../../../agent-runs/index.js';
import type { RunWait, RunWaitLookup } from '../../business/port/run/run-wait-lookup.js';

export class AgentRunsRunWaitLookup implements RunWaitLookup {
  constructor(private readonly agentRuns: Pick<AgentRunsApi, 'activeWaits'>) {}

  async waitsOf(projectId: string): Promise<ReadonlyArray<RunWait>> {
    return (await this.agentRuns.activeWaits(projectId)).map(({ ticketNumber, kind, since }) => ({
      ticketNumber,
      kind,
      since,
    }));
  }
}
