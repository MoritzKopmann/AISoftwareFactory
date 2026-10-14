import type { RunStage } from './run-stage.js';
import type { RunWait } from './run-wait.js';

export type WaitingRun = {
  readonly runId: string;
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly stage: RunStage;
  readonly wait: RunWait;
};
