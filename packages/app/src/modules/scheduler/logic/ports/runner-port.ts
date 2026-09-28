export interface RunnerPort {
  start(request: { readonly projectId: string; readonly ticketNumber: number }): Promise<void>;
  activeRun(projectId: string): Promise<{ readonly ticketNumber: number } | undefined>;
  lastRunEndedAt(projectId: string, ticketNumber: number): Promise<string | undefined>;
  settle(runId: string): Promise<void>;
}
