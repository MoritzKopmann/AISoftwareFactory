export interface SchedulerPort {
  /** Throws `PageBusyError` when the scheduler refuses the answer. */
  answer(runId: string, text: string): Promise<void>;
}
