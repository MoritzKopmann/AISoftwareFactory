import type { AgentRunsApi } from '../../../agent-runs/index.js';
import type { ActiveRunLookup } from '../../business/port/run/active-run-lookup.js';

export class AgentRunsActiveRunLookup implements ActiveRunLookup {
  constructor(private readonly agentRuns: Pick<AgentRunsApi, 'activeRuns'>) {}

  async activeRunTicketNumbers(projectId: string): Promise<ReadonlyArray<number>> {
    return (await this.agentRuns.activeRuns(projectId)).map(({ run }) => run.ticketNumber);
  }
}
