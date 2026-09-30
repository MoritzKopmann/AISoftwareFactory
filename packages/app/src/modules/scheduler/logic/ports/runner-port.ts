import type { ActiveTicketRun } from '../domain/types/active-ticket-run.js';
import type { LatestRun } from '../domain/types/latest-run.js';
import type { PermissionDecision } from '../domain/types/permission-decision.js';
import type { RunRecord } from '../domain/types/run-record.js';
import type { SessionLog } from '../domain/types/session-log.js';
import type { StartedRun } from '../domain/types/started-run.js';

export interface RunnerPort {
  start(request: {
    readonly projectId: string;
    readonly ticketNumber: number;
  }): Promise<StartedRun>;
  resume(runId: string, decision: PermissionDecision): Promise<StartedRun>;
  findRun(runId: string): Promise<RunRecord | undefined>;
  activeRun(projectId: string): Promise<ActiveTicketRun | undefined>;
  latestRun(projectId: string, ticketNumber: number): Promise<LatestRun | undefined>;
  settle(runId: string): Promise<void>;
  sessionLog(runId: string): Promise<SessionLog>;
}
