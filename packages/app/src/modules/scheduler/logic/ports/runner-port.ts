import type { StartedRun } from '../domain/types/started-run.js';

export interface RunnerPort {
  start(request: {
    readonly projectId: string;
    readonly ticketNumber: number;
  }): Promise<StartedRun>;
  activeRun(projectId: string): Promise<{ readonly ticketNumber: number } | undefined>;
  lastRunEndedAt(projectId: string, ticketNumber: number): Promise<string | undefined>;
  settle(runId: string): Promise<void>;
}
