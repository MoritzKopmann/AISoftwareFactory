import type { AgentRunsApi } from '../../../agent-runs/index.js';
import type { RunPort, RunWait } from '../../business/port/run/run-port.js';

export class AgentRunsAdapter implements RunPort {
  constructor(
    private readonly agentRuns: Pick<AgentRunsApi, 'activeRuns' | 'activeWaits' | 'settle'>,
  ) {}

  async activeRunTicketNumbers(projectId: string): Promise<ReadonlyArray<number>> {
    return (await this.agentRuns.activeRuns(projectId)).map(({ run }) => run.ticketNumber);
  }

  settle(runId: string): Promise<void> {
    return this.agentRuns.settle(runId);
  }

  async waitsOf(projectId: string): Promise<ReadonlyArray<RunWait>> {
    return (await this.agentRuns.activeWaits(projectId)).map(({ ticketNumber, kind, since }) => ({
      ticketNumber,
      kind,
      since,
    }));
  }
}
