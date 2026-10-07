import type { TicketLatestRun } from '../../../../src/modules/artifacts/logic/domain/types/ticket-latest-run.js';
import type { TicketRunLookup } from '../../../../src/modules/artifacts/logic/ports/ticket-run-lookup.js';

export class FakeTicketRunLookup implements TicketRunLookup {
  latestRun: TicketLatestRun | undefined;

  async latest(): Promise<TicketLatestRun | undefined> {
    return this.latestRun;
  }
}
