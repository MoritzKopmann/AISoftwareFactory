import type { ActiveTicketRun } from '../domain/types/active-ticket-run.js';
import type { LatestRun } from '../domain/types/latest-run.js';
import type { SessionLog } from '../domain/types/session-log.js';
import type { StartedRun } from '../domain/types/started-run.js';

export interface RunnerPort {
  start(request: {
    readonly projectId: string;
    readonly ticketNumber: number;
  }): Promise<StartedRun>;
  activeRun(projectId: string): Promise<ActiveTicketRun | undefined>;
  latestRun(projectId: string, ticketNumber: number): Promise<LatestRun | undefined>;
  settle(runId: string): Promise<void>;
  readSessionLog(runId: string): Promise<SessionLog>;
}
