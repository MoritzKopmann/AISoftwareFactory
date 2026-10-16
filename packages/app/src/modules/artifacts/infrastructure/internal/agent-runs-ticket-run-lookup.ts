import type { AgentRunsApi } from '../../../agent-runs/index.js';
import type { TicketLatestRun } from '../../business/domain/types/ticket-latest-run.js';
import type { TicketRunLookup } from '../../business/port/run/ticket-run-lookup.js';

export class AgentRunsTicketRunLookup implements TicketRunLookup {
  constructor(private readonly agentRuns: Pick<AgentRunsApi, 'latestRun'>) {}

  latest(projectId: string, ticketNumber: number): Promise<TicketLatestRun | undefined> {
    return this.agentRuns.latestRun(projectId, ticketNumber);
  }
}
