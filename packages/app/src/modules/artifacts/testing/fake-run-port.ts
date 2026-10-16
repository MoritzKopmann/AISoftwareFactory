import type { TicketLatestRun } from '../business/domain/types/ticket-latest-run.js';
import type { RunPort } from '../business/port/run/run-port.js';

export class FakeRunPort implements RunPort {
  latestRun: TicketLatestRun | undefined;

  async latest(): Promise<TicketLatestRun | undefined> {
    return this.latestRun;
  }
}
