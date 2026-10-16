import type { RunnerApi } from '../../../runner/index.js';
import type { TicketLatestRun } from '../../business/domain/types/ticket-latest-run.js';
import type { TicketRunLookup } from '../../business/port/run/ticket-run-lookup.js';

export class RunnerTicketRunLookup implements TicketRunLookup {
  constructor(private readonly runner: Pick<RunnerApi, 'latestRun'>) {}

  latest(projectId: string, ticketNumber: number): Promise<TicketLatestRun | undefined> {
    return this.runner.latestRun(projectId, ticketNumber);
  }
}
