import type { AgentRunsApi } from '../../../agent-runs/index.js';
import type { ActiveTicketRun } from '../../business/domain/types/active-ticket-run.js';
import type { LatestRun } from '../../business/domain/types/latest-run.js';
import type { RunAnswer } from '../../business/domain/types/run-answer.js';
import type { RunRecord } from '../../business/domain/types/run-record.js';
import type { StartedRun } from '../../business/domain/types/started-run.js';
import { RunAlreadyActiveError } from '../../business/errors/run-already-active-error.js';
import { RunNotAnswerableError } from '../../business/errors/run-not-answerable-error.js';
import type { AgentRunControl } from '../../business/port/runs/agent-run-control.js';

export class AgentRunsAgentRunControl implements AgentRunControl {
  constructor(
    private readonly agentRuns: Pick<
      AgentRunsApi,
      'start' | 'answer' | 'findRun' | 'activeRuns' | 'latestRun'
    >,
  ) {}

  async start(request: Parameters<AgentRunControl['start']>[0]): Promise<StartedRun> {
    const result = await this.agentRuns.start({ ...request, mode: 'afk' });
    if (result.kind === 'already-active') {
      throw new RunAlreadyActiveError(result.message);
    }
    return result.run;
  }

  async answer(runId: string, answer: RunAnswer): Promise<StartedRun> {
    const result = await this.agentRuns.answer(runId, answer);
    switch (result.kind) {
      case 'already-active':
        throw new RunAlreadyActiveError(result.message);
      case 'not-resumable':
        throw new RunNotAnswerableError(result.message);
      case 'answered':
        return result.run;
    }
  }

  findRun(runId: string): Promise<RunRecord | undefined> {
    return this.agentRuns.findRun(runId);
  }

  activeRuns(projectId: string): Promise<ReadonlyArray<ActiveTicketRun>> {
    return this.agentRuns.activeRuns(projectId);
  }

  latestRun(projectId: string, ticketNumber: number): Promise<LatestRun | undefined> {
    return this.agentRuns.latestRun(projectId, ticketNumber);
  }
}
