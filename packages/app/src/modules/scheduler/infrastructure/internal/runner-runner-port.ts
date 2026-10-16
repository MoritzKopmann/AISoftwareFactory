import type { RunnerApi } from '../../../runner/index.js';
import type { ActiveTicketRun } from '../../business/domain/types/active-ticket-run.js';
import type { LatestRun } from '../../business/domain/types/latest-run.js';
import type { RunAnswer } from '../../business/domain/types/run-answer.js';
import type { RunRecord } from '../../business/domain/types/run-record.js';
import type { StartedRun } from '../../business/domain/types/started-run.js';
import { RunAlreadyActiveError } from '../../business/errors/run-already-active-error.js';
import { RunNotAnswerableError } from '../../business/errors/run-not-answerable-error.js';
import type { RunnerPort } from '../../business/port/runner/runner-port.js';

export class RunnerRunnerPort implements RunnerPort {
  constructor(
    private readonly runner: Pick<
      RunnerApi,
      'start' | 'answer' | 'findRun' | 'activeRuns' | 'latestRun'
    >,
  ) {}

  async start(request: Parameters<RunnerPort['start']>[0]): Promise<StartedRun> {
    const result = await this.runner.start({ ...request, mode: 'afk' });
    if (result.kind === 'already-active') {
      throw new RunAlreadyActiveError(result.message);
    }
    return result.run;
  }

  async answer(runId: string, answer: RunAnswer): Promise<StartedRun> {
    const result = await this.runner.answer(runId, answer);
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
    return this.runner.findRun(runId);
  }

  activeRuns(projectId: string): Promise<ReadonlyArray<ActiveTicketRun>> {
    return this.runner.activeRuns(projectId);
  }

  latestRun(projectId: string, ticketNumber: number): Promise<LatestRun | undefined> {
    return this.runner.latestRun(projectId, ticketNumber);
  }
}
