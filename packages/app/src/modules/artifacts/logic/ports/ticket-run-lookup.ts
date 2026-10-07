import type { TicketLatestRun } from '../domain/types/ticket-latest-run.js';

export interface TicketRunLookup {
  latest(projectId: string, ticketNumber: number): Promise<TicketLatestRun | undefined>;
}
