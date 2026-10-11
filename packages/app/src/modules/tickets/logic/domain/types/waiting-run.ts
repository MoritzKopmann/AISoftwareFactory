import type { RunWait } from './run-wait.js';

export type WaitingRun = {
  readonly runId: string;
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly wait: RunWait;
};
