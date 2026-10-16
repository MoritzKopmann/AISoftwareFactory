import type { TicketLatestRun } from '../../domain/types/ticket-latest-run.js';

export interface RunPort {
  latest(projectId: string, ticketNumber: number): Promise<TicketLatestRun | undefined>;
}
