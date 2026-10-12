import type { TicketLatestRun } from '../../logic/domain/types/ticket-latest-run.js';
import type { TicketRunLookup } from '../../logic/ports/ticket-run-lookup.js';
import type { RunnerModule } from '../../../runner/index.js';

export class RunnerModuleTicketRunLookup implements TicketRunLookup {
  constructor(private readonly runner: () => Pick<RunnerModule, 'latestRun'>) {}

  latest(projectId: string, ticketNumber: number): Promise<TicketLatestRun | undefined> {
    return this.runner().latestRun(projectId, ticketNumber);
  }
}
