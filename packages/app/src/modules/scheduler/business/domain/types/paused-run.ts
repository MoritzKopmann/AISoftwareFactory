import type { RunAnswer } from './run-answer.js';

export type PausedRun = {
  readonly runId: string;
  readonly ticketNumber: number;
  readonly heldAnswer?: RunAnswer;
};
