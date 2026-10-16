import type { TicketLatestRun } from '../business/domain/types/ticket-latest-run.js';
import type { TicketRunLookup } from '../business/port/run/ticket-run-lookup.js';

export class FakeTicketRunLookup implements TicketRunLookup {
  latestRun: TicketLatestRun | undefined;

  async latest(): Promise<TicketLatestRun | undefined> {
    return this.latestRun;
  }
}
