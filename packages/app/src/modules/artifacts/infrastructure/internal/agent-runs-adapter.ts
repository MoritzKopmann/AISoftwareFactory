import type { AgentRunsApi } from '../../../agent-runs/index.js';
import type { TicketLatestRun } from '../../business/domain/types/ticket-latest-run.js';
import type { RunPort } from '../../business/port/run/run-port.js';

export class AgentRunsAdapter implements RunPort {
  constructor(private readonly agentRuns: Pick<AgentRunsApi, 'latestRun'>) {}

  latest(projectId: string, ticketNumber: number): Promise<TicketLatestRun | undefined> {
    return this.agentRuns.latestRun(projectId, ticketNumber);
  }
}
