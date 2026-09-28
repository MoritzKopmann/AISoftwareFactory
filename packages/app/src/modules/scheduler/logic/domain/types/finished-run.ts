import type { RunEnding } from './run-ending.js';

export type FinishedRun = {
  readonly runId: string;
  readonly projectId: string;
  readonly ticketNumber: number;
  readonly ending: RunEnding;
};
