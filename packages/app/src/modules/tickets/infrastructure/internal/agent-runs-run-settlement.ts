import type { AgentRunsApi } from '../../../agent-runs/index.js';
import type { RunSettlement } from '../../business/port/run/run-settlement.js';

export class AgentRunsRunSettlement implements RunSettlement {
  constructor(private readonly agentRuns: Pick<AgentRunsApi, 'settle'>) {}

  settle(runId: string): Promise<void> {
    return this.agentRuns.settle(runId);
  }
}
