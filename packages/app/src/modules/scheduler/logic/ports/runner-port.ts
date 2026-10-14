import type { TicketStatus } from '../../../../shared/ticket-status/ticket-status.js';
import type { TicketType } from '../../../../shared/ticket-type/ticket-type.js';
import type { ActiveTicketRun } from '../domain/types/active-ticket-run.js';
import type { LatestRun } from '../domain/types/latest-run.js';
import type { RunAnswer } from '../domain/types/run-answer.js';
import type { RunRecord } from '../domain/types/run-record.js';
import type { StartedRun } from '../domain/types/started-run.js';

export interface RunnerPort {
  start(request: {
    readonly projectId: string;
    readonly ticketNumber: number;
    readonly ticketTitle: string;
    readonly status: TicketStatus;
    readonly types: ReadonlyArray<TicketType>;
  }): Promise<StartedRun>;
  answer(runId: string, answer: RunAnswer): Promise<StartedRun>;
  findRun(runId: string): Promise<RunRecord | undefined>;
  activeRuns(projectId: string): Promise<ReadonlyArray<ActiveTicketRun>>;
  latestRun(projectId: string, ticketNumber: number): Promise<LatestRun | undefined>;
}
